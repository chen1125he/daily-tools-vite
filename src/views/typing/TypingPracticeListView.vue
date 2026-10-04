<script setup lang="ts">
import axios from "axios";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NDataTable, NSpace, NTag, useMessage, type DataTableColumns } from "naive-ui";
import {
  listTypingPractices,
  type TypingPractice,
  type TypingPracticeStatus
} from "../../api/modules/typing";

const router = useRouter();
const message = useMessage();

const STATUS_LABEL: Record<TypingPracticeStatus, string> = {
  pending: "未开始",
  in_progress: "进行中",
  completed: "已完成"
};

const STATUS_TYPE: Record<TypingPracticeStatus, "default" | "info" | "success"> = {
  pending: "default",
  in_progress: "info",
  completed: "success"
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
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

const loading = ref(false);
const practices = ref<TypingPractice[]>([]);

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchPractices();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchPractices();
  }
});

const columns: DataTableColumns<TypingPractice> = [
  {
    title: "文章",
    key: "article",
    ellipsis: { tooltip: true },
    render: (row) => row.typing_article?.title ?? `#${row.typing_article_id}`
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render: (row) =>
      h(
        NTag,
        { size: "small", type: STATUS_TYPE[row.status] },
        { default: () => STATUS_LABEL[row.status] }
      )
  },
  {
    title: "准确率",
    key: "accuracy",
    width: 90,
    render: (row) => formatPercent(row.accuracy)
  },
  {
    title: "速度",
    key: "cpm",
    width: 90,
    render: (row) => formatCpm(row.cpm)
  },
  {
    title: "用时",
    key: "duration_ms",
    width: 110,
    render: (row) => formatDurationMs(row.duration_ms)
  },
  {
    title: "时间",
    key: "created_at",
    width: 180,
    render: (row) => formatTime(row.finished_at ?? row.created_at)
  },
  {
    title: "操作",
    key: "actions",
    width: 120,
    render: (row) =>
      h(
        NButton,
        {
          size: "small",
          type: "primary",
          onClick: () => router.push(`/typing/practices/${row.id}`)
        },
        { default: () => (row.status === "completed" ? "查看" : "继续") }
      )
  }
];

const fetchPractices = async () => {
  loading.value = true;
  try {
    const res = await listTypingPractices({
      page: pagination.page,
      limit: pagination.pageSize
    });
    practices.value = res.items;
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载练习记录失败"));
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void fetchPractices();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="练习记录">
        <n-space vertical size="medium" class="content-stack">
          <n-space>
            <n-button type="default" @click="router.push('/typing')">返回文章列表</n-button>
          </n-space>
          <n-data-table
            remote
            :columns="columns"
            :data="practices"
            :loading="loading"
            :pagination="pagination"
            :bordered="false"
            :scroll-x="900"
          />
        </n-space>
      </n-card>
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
</style>
