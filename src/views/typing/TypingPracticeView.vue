<script setup lang="ts">
import axios from "axios";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NSpace,
  NSpin,
  NTag,
  useMessage,
  type DataTableColumns
} from "naive-ui";
import {
  completeTypingPractice,
  createTypingErrorMark,
  formatWubiRoots,
  getTypingArticle,
  getTypingPractice,
  startTypingPractice,
  updateTypingPractice,
  type TypingErrorMark,
  type TypingPractice,
  type TypingPracticeStatus,
  type TypingWord
} from "../../api/modules/typing";
import TypingPracticeBoard from "../../components/TypingPractice.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const STATUS_LABEL: Record<TypingPracticeStatus, string> = {
  pending: "未开始",
  in_progress: "进行中",
  completed: "已完成"
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

function formatPercent(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

function formatCpm(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)} 字/分` : "—";
}

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

const practiceId = computed(() => Number(route.params.id));
const loading = ref(false);
const starting = ref(false);
const submitting = ref(false);
const practice = ref<TypingPractice | null>(null);
const typedBody = ref("");
const boardRef = ref<{
  scrollToTypingPosition?: (options?: { pinPageTop?: boolean }) => void;
  focusInput?: (options?: { preventScroll?: boolean }) => Promise<void>;
} | null>(null);
const nowMs = ref(Date.now());
const SAVE_INTERVAL_MS = 30_000;
let tickTimer: number | null = null;
let saveTimer: number | null = null;
let lastSavedBody = "";
let savingDraft = false;

const syncBoardToTypingPosition = async () => {
  await nextTick();
  requestAnimationFrame(() => {
    boardRef.value?.scrollToTypingPosition?.({ pinPageTop: true });
    window.scrollTo(0, 0);
  });
};

const articleTitle = computed(() => practice.value?.typing_article?.title ?? "打字练习");
const articleBody = computed(() => practice.value?.typing_article?.body ?? "");
const isInProgress = computed(() => practice.value?.status === "in_progress");
const isCompleted = computed(() => practice.value?.status === "completed");

const liveDurationLabel = computed(() => {
  const startedAt = practice.value?.started_at;
  if (!startedAt) return "0 秒";
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "0 秒";
  return formatDurationMs(Math.max(0, nowMs.value - started));
});

const errorMarks = computed(() => practice.value?.typing_error_marks ?? []);

const errorColumns: DataTableColumns<TypingErrorMark> = [
  {
    title: "汉字",
    key: "character",
    width: 80,
    render: (row) => row.typing_word?.character ?? "—"
  },
  {
    title: "五笔",
    key: "wubi_code",
    width: 100,
    render: (row) => row.typing_word?.wubi_code ?? "—"
  },
  {
    title: "字根",
    key: "wubi_roots",
    minWidth: 120,
    render: (row) => formatWubiRoots(row.typing_word?.wubi_roots) || "—"
  },
  {
    title: "出错次数",
    key: "mistake_count",
    width: 100,
    render: (row) => String(row.mistake_count)
  }
];

const mergeTypingWord = (prev: TypingWord | undefined, next: TypingWord): TypingWord => {
  const roots = next.wubi_roots?.length ? next.wubi_roots : prev?.wubi_roots;
  return {
    ...prev,
    ...next,
    wubi_code: next.wubi_code || prev?.wubi_code || null,
    wubi_roots: roots ?? next.wubi_roots ?? null
  };
};

const upsertLocalErrorMark = (mark: TypingErrorMark) => {
  if (!practice.value) return;
  const marks = [...(practice.value.typing_error_marks ?? [])];
  const index = marks.findIndex((item) => item.id === mark.id);
  const merged: TypingErrorMark = {
    ...mark,
    typing_word: mergeTypingWord(index >= 0 ? marks[index].typing_word : undefined, mark.typing_word)
  };
  if (index >= 0) {
    marks[index] = merged;
  } else {
    marks.push(merged);
  }
  practice.value = { ...practice.value, typing_error_marks: marks };
};

const applyWubiHintToErrorMarks = (payload: { character: string; wubiCode: string; wubiRoots: string[] }) => {
  if (!practice.value) return;
  const marks = practice.value.typing_error_marks ?? [];
  let changed = false;
  const next = marks.map((mark) => {
    if (mark.typing_word?.character !== payload.character) return mark;
    changed = true;
    return {
      ...mark,
      typing_word: mergeTypingWord(mark.typing_word, {
        ...mark.typing_word,
        wubi_code: payload.wubiCode,
        wubi_roots: payload.wubiRoots
      })
    };
  });
  if (changed) practice.value = { ...practice.value, typing_error_marks: next };
};

const persistTypedBody = async () => {
  const current = practice.value;
  if (!current || current.status !== "in_progress" || submitting.value) return;
  const typed = typedBody.value;
  if (typed === lastSavedBody || savingDraft) return;
  savingDraft = true;
  try {
    const record = await updateTypingPractice(current.id, { typed_body: typed });
    lastSavedBody = typed;
    if (practice.value?.id === current.id) {
      practice.value = {
        ...practice.value,
        typed_body: record.typed_body,
        updated_at: record.updated_at
      };
    }
  } catch {
    // 自动保存失败不打断打字
  } finally {
    savingDraft = false;
  }
};

const stopAutosave = () => {
  if (saveTimer != null) {
    window.clearInterval(saveTimer);
    saveTimer = null;
  }
};

const startAutosave = () => {
  stopAutosave();
  saveTimer = window.setInterval(() => {
    void persistTypedBody();
  }, SAVE_INTERVAL_MS);
};

const ensureArticle = async (record: TypingPractice): Promise<TypingPractice> => {
  if (record.typing_article) return record;
  try {
    const article = await getTypingArticle(record.typing_article_id);
    return { ...record, typing_article: article };
  } catch {
    return record;
  }
};

const loadPractice = async () => {
  if (!Number.isInteger(practiceId.value) || practiceId.value <= 0) {
    message.error("练习 ID 不合法");
    void router.replace("/typing");
    return;
  }
  loading.value = true;
  try {
    const record = await ensureArticle(await getTypingPractice(practiceId.value));
    practice.value = record;
    typedBody.value = record.typed_body ?? "";
    lastSavedBody = typedBody.value;
    if (record.status === "pending") {
      await handleStart();
    }
  } catch (error) {
    message.error(apiErrorMessage(error, "加载练习失败"));
    void router.replace("/typing/practices");
  } finally {
    loading.value = false;
    void syncBoardToTypingPosition();
  }
};

const handleStart = async () => {
  if (!practice.value) return;
  starting.value = true;
  try {
    const record = await ensureArticle(await startTypingPractice(practice.value.id));
    practice.value = record;
    typedBody.value = record.typed_body ?? typedBody.value;
    lastSavedBody = typedBody.value;
  } catch (error) {
    message.error(apiErrorMessage(error, "开始练习失败"));
  } finally {
    starting.value = false;
    void syncBoardToTypingPosition();
  }
};

const handleMistake = async (payload: { character: string; wubiCode?: string }) => {
  if (!practice.value || practice.value.status !== "in_progress") return;
  try {
    const mark = await createTypingErrorMark(practice.value.id, {
      character: payload.character,
      wubi_code: payload.wubiCode
    });
    upsertLocalErrorMark(mark);
  } catch {
    // 打字过程中不打断输入，错字记录失败时静默忽略
  }
};

const handleComplete = async () => {
  if (!practice.value || practice.value.status !== "in_progress" || submitting.value) return;
  const typed = typedBody.value;
  if (!typed.trim()) {
    message.warning("请先输入内容再提交");
    return;
  }
  submitting.value = true;
  stopAutosave();
  try {
    const record = await ensureArticle(await completeTypingPractice(practice.value.id, typed));
    practice.value = record;
    typedBody.value = record.typed_body ?? typed;
    lastSavedBody = typedBody.value;
    message.success("练习已完成");
  } catch (error) {
    message.error(apiErrorMessage(error, "提交成绩失败"));
    if (practice.value?.status === "in_progress") startAutosave();
  } finally {
    submitting.value = false;
  }
};

watch(isInProgress, (inProgress) => {
  if (inProgress) startAutosave();
  else stopAutosave();
});

onMounted(() => {
  tickTimer = window.setInterval(() => {
    nowMs.value = Date.now();
  }, 500);
  void loadPractice();
});

onUnmounted(() => {
  stopAutosave();
  void persistTypedBody();
  if (tickTimer != null) {
    window.clearInterval(tickTimer);
  }
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-spin :show="loading || starting">
        <n-card v-if="practice" :title="articleTitle">
          <n-space vertical size="medium" class="content-stack">
            <n-space wrap>
              <n-button quaternary @click="router.push('/typing')">返回文章列表</n-button>
              <n-button quaternary @click="router.push('/typing/practices')">练习记录</n-button>
              <n-tag v-if="practice.status" size="small" :type="isCompleted ? 'success' : 'info'">
                {{ STATUS_LABEL[practice.status] }}
              </n-tag>
            </n-space>

            <template v-if="isInProgress">
              <p class="meta">用时 {{ liveDurationLabel }} · 打错汉字会自动记入错字表</p>
              <TypingPracticeBoard
                ref="boardRef"
                v-model="typedBody"
                :target-text="articleBody"
                :record-mistake="handleMistake"
                @wubi-hint="applyWubiHintToErrorMarks"
              />
              <n-space justify="end">
                <n-button type="primary" :loading="submitting" :disabled="!typedBody.trim()" @click="handleComplete">
                  完成练习
                </n-button>
              </n-space>
              <n-card v-if="errorMarks.length" title="本次错字" size="small">
                <n-data-table :columns="errorColumns" :data="errorMarks" :bordered="false" :pagination="false" />
              </n-card>
            </template>

            <template v-else-if="isCompleted">
              <n-descriptions :column="2" bordered>
                <n-descriptions-item label="准确率">{{ formatPercent(practice.accuracy) }}</n-descriptions-item>
                <n-descriptions-item label="速度">{{ formatCpm(practice.cpm) }}</n-descriptions-item>
                <n-descriptions-item label="正确字数">{{ practice.correct_count }}</n-descriptions-item>
                <n-descriptions-item label="错误字数">{{ practice.error_count }}</n-descriptions-item>
                <n-descriptions-item label="用时">{{ formatDurationMs(practice.duration_ms) }}</n-descriptions-item>
                <n-descriptions-item label="完成时间">{{ formatTime(practice.finished_at) }}</n-descriptions-item>
              </n-descriptions>
              <section>
                <h3 class="section-title">原文</h3>
                <p class="body-text">{{ articleBody }}</p>
              </section>
              <section>
                <h3 class="section-title">实打内容</h3>
                <p class="body-text">{{ practice.typed_body || "—" }}</p>
              </section>
              <section>
                <h3 class="section-title">错字记录</h3>
                <n-data-table
                  v-if="errorMarks.length"
                  :columns="errorColumns"
                  :data="errorMarks"
                  :bordered="false"
                  :pagination="false"
                />
                <n-empty v-else description="本次没有错字记录" />
              </section>
              <n-space justify="end">
                <n-button type="primary" @click="router.push('/typing')">再练一篇</n-button>
              </n-space>
            </template>

            <template v-else>
              <n-empty description="练习尚未开始">
                <n-button type="primary" :loading="starting" @click="handleStart">开始计时</n-button>
              </n-empty>
            </template>
          </n-space>
        </n-card>
      </n-spin>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  justify-content: center;
}

.page-inner {
  width: 100%;
  max-width: 960px;
}

.content-stack {
  width: 100%;
}

.meta {
  margin: 0;
  color: rgba(127, 127, 127, 0.95);
  font-size: 13px;
}

.section-title {
  margin: 8px 0 8px;
  font-size: 15px;
}

.body-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.06);
  border: 1px solid rgba(127, 127, 127, 0.18);
}
</style>
