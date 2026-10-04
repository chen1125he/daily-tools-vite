<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { NButton, NInput, NSlider, NSpace } from "naive-ui";
import { lookupTypingWord, type TypingWord } from "../api/modules/typing";
import TypingPracticeChunk from "./TypingPracticeChunk.vue";

const props = withDefaults(
  defineProps<{
    targetText: string;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  mistake: [payload: { character: string; wubiCode?: string; index: number }];
  wubiHint: [payload: { character: string; wubiCode: string; wubiRoots: string[] }];
}>();

const typedText = defineModel<string>({ default: "" });

const SOUND = {
  original: "/sounds/type-mx-blue.mp3",
  high: "/sounds/mx-blue-key-high.wav",
  low: "/sounds/mx-blue-key-low.wav",
  sharp: "/sounds/mx-blue-key-sharp.wav",
  enter: "/sounds/mx-blue-enter.wav",
  punct: "/sounds/mx-blue-punct.wav"
} as const;

const ALL_SOUNDS = Object.values(SOUND);

const NUMBER_ROW = new Set("1234567890-=".split(""));
const NUMBER_ROW_SHIFT = new Set("!@#$%^&*()_+".split(""));
const TOP_LETTER_ROW = new Set("qwertyuiop[]\\".split(""));
const TOP_LETTER_ROW_SHIFT = new Set("{}|".split(""));
const HOME_LETTER_ROW = new Set("asdfghjkl".split(""));
const BOTTOM_LETTER_ROW = new Set("zxcvbnm".split(""));
const PUNCT_KEYS = new Set(".,;:'\"/?`~，。、；：！？「」『』“”‘’《》—…".split(""));
const BOTTOM_PUNCT_SHIFT = new Set("<>?".split(""));
const HOME_PUNCT = new Set(";:'\"".split(""));

const POOL_SIZE = 4;
const CHUNK_SIZE = 32;
const VOLUME_STORAGE_KEY = "typing-practice-volume";
const DEFAULT_VOLUME = 0.28;
const HANZI_RE = /^[\u4e00-\u9fff]$/;

const readStoredVolume = () => {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsed = raw == null ? DEFAULT_VOLUME : Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, parsed));
  } catch {
    return DEFAULT_VOLUME;
  }
};

const composing = ref(false);
const committedText = ref(typedText.value);
const wubiBuffer = ref("");
const inputRef = ref<InstanceType<typeof NInput> | null>(null);
const targetRef = ref<HTMLElement | null>(null);
const volume = ref(readStoredVolume());
const audioPools = new Map<string, HTMLAudioElement[]>();
const poolIndexes = new Map<string, number>();
type WubiHint = {
  code: string;
  roots: string[];
};

const wubiCache = new Map<string, WubiHint>();
const wubiInflight = new Map<string, Promise<WubiHint | null>>();
const hintByIndex = ref<Record<number, WubiHint>>({});
const shownHintIndex = ref<number | null>(null);
const hintLoading = ref(false);
let nativeInput: HTMLInputElement | HTMLTextAreaElement | null = null;
let lastKeySoundAt = 0;

const comparisonText = computed(() => (composing.value ? committedText.value : typedText.value));
const targetChars = computed(() => [...props.targetText]);
const typedChars = computed(() => [...comparisonText.value]);

const chunks = computed(() => {
  const chars = targetChars.value;
  const result: { start: number; chars: string[]; clickable: boolean[] }[] = [];
  for (let i = 0; i < chars.length; i += CHUNK_SIZE) {
    const slice = chars.slice(i, i + CHUNK_SIZE);
    result.push({
      start: i,
      chars: slice,
      clickable: slice.map((char) => HANZI_RE.test(char))
    });
  }
  return result;
});

const chunkTyped = computed(() =>
  chunks.value.map((chunk) => typedChars.value.slice(chunk.start, chunk.start + chunk.chars.length).join(""))
);

const cursorChunkStart = computed(() => {
  const typedLen = typedChars.value.length;
  if (typedLen >= targetChars.value.length) return null;
  return Math.floor(typedLen / CHUNK_SIZE) * CHUNK_SIZE;
});

const currentIndex = computed(() => {
  const total = targetChars.value.length;
  if (total === 0) return null;
  const typedLen = typedChars.value.length;
  return typedLen >= total ? total - 1 : typedLen;
});

const ensureCurrentVisible = () => {
  const scroller = targetRef.value;
  const index = currentIndex.value;
  if (!scroller || index == null) return;
  const current = scroller.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
  if (!current) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const currentRect = current.getBoundingClientRect();
  const lineTop = currentRect.top - scrollerRect.top + scroller.scrollTop;
  const lineBottom = lineTop + Math.max(currentRect.height, 1);
  const pad = 8;
  if (lineTop < scroller.scrollTop + pad) {
    scroller.scrollTo({ top: Math.max(0, lineTop - pad), behavior: "auto" });
    return;
  }
  if (lineBottom > scroller.scrollTop + scroller.clientHeight - pad) {
    scroller.scrollTo({
      top: lineBottom - scroller.clientHeight + pad,
      behavior: "auto"
    });
  }
};

const shownHintChar = computed(() =>
  shownHintIndex.value == null ? "" : (targetChars.value[shownHintIndex.value] ?? "")
);

const activeHint = computed(() =>
  shownHintIndex.value == null ? null : (hintByIndex.value[shownHintIndex.value] ?? null)
);

const hintIndexForChunk = (start: number, length: number) => {
  const index = shownHintIndex.value;
  if (index == null || index < start || index >= start + length) return null;
  return index;
};

const clearHints = () => {
  hintByIndex.value = {};
  shownHintIndex.value = null;
  hintLoading.value = false;
};

const hintFromWord = (word: TypingWord): WubiHint | null => {
  const code = word.wubi_code?.trim().toLowerCase() ?? "";
  if (!code) return null;
  const roots = Array.isArray(word.wubi_roots)
    ? word.wubi_roots.map((item) => item.trim()).filter(Boolean)
    : [];
  return { code, roots };
};

const fetchWubiHint = (character: string) => {
  const cached = wubiCache.get(character);
  if (cached) return Promise.resolve(cached);
  const pending = wubiInflight.get(character);
  if (pending) return pending;
  const request = lookupTypingWord(character)
    .then((word) => {
      const hint = hintFromWord(word);
      if (hint) wubiCache.set(character, hint);
      return hint;
    })
    .catch(() => null)
    .finally(() => {
      wubiInflight.delete(character);
    });
  wubiInflight.set(character, request);
  return request;
};

const requestHint = async (index: number, character: string) => {
  if (!HANZI_RE.test(character)) return;
  if (hintByIndex.value[index]) return;
  hintLoading.value = true;
  try {
    const hint = await fetchWubiHint(character);
    if (shownHintIndex.value !== index) return;
    if (!hint) return;
    hintByIndex.value = { ...hintByIndex.value, [index]: hint };
    emit("wubiHint", { character, wubiCode: hint.code, wubiRoots: hint.roots });
  } finally {
    if (shownHintIndex.value === index) hintLoading.value = false;
  }
};

const isFinished = computed(() => {
  const target = targetChars.value;
  const typed = typedChars.value;
  return target.length > 0 && typed.length >= target.length && typed.every((char, index) => char === target[index]);
});

const accuracy = computed(() => {
  const typed = typedChars.value;
  if (!typed.length) return 100;
  const target = targetChars.value;
  const compared = Math.min(typed.length, target.length);
  let correct = 0;
  for (let i = 0; i < compared; i += 1) {
    if (typed[i] === target[i]) correct += 1;
  }
  return Math.round((correct / typed.length) * 100);
});

const applyVolume = (value: number) => {
  for (const pool of audioPools.values()) {
    for (const audio of pool) {
      audio.volume = value;
    }
  }
};

const ensurePool = (src: string) => {
  if (audioPools.has(src)) return;
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume.value;
    pool.push(audio);
  }
  audioPools.set(src, pool);
  poolIndexes.set(src, 0);
};

const ensureAllPools = () => {
  for (const src of ALL_SOUNDS) {
    ensurePool(src);
  }
};

const pickSound = (char: string) => {
  if (char === " ") return SOUND.low;
  if (char === "\n") return SOUND.enter;
  if (char === "\b") return SOUND.enter;
  const lower = char.toLowerCase();
  if (TOP_LETTER_ROW.has(lower) || TOP_LETTER_ROW_SHIFT.has(char)) return SOUND.high;
  if (BOTTOM_LETTER_ROW.has(lower)) return SOUND.low;
  if (HOME_LETTER_ROW.has(lower)) return SOUND.original;
  if (NUMBER_ROW.has(char) || NUMBER_ROW_SHIFT.has(char)) return SOUND.sharp;
  if (PUNCT_KEYS.has(char) || HOME_PUNCT.has(char) || BOTTOM_PUNCT_SHIFT.has(char)) return SOUND.punct;
  return SOUND.original;
};

const playSrc = (src: string) => {
  ensurePool(src);
  const pool = audioPools.get(src);
  if (!pool?.length) return;
  const index = poolIndexes.get(src) ?? 0;
  const audio = pool[index];
  poolIndexes.set(src, (index + 1) % pool.length);
  audio.volume = volume.value;
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
};

const playTypeSound = (char = "a") => {
  playSrc(pickSound(char));
};

const previewSounds = () => {
  playSrc(SOUND.high);
  window.setTimeout(() => playSrc(SOUND.original), 200);
  window.setTimeout(() => playSrc(SOUND.low), 400);
};

const CODE_TO_CHAR: Record<string, string> = {
  Space: " ",
  Backspace: "\b",
  Enter: "\n",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Digit0: "0",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9"
};

const keyFromEvent = (event: KeyboardEvent) => {
  if (event.key === "Backspace") return "\b";
  if (event.key === "Enter") return "\n";
  if (event.key === " ") return " ";
  if (event.key.length === 1) return event.key;
  const fromCode = CODE_TO_CHAR[event.code];
  if (fromCode) return fromCode;
  const letter = /^Key([A-Z])$/.exec(event.code);
  if (letter) return letter[1].toLowerCase();
  return null;
};

const detectMistakes = (prev: string, next: string) => {
  if (props.disabled) return;
  const prevChars = [...prev];
  const nextChars = [...next];
  const expectedChars = targetChars.value;
  const newlyWrong: number[] = [];
  const len = Math.min(nextChars.length, expectedChars.length);
  for (let i = 0; i < len; i += 1) {
    const expected = expectedChars[i];
    if (!HANZI_RE.test(expected)) continue;
    if (nextChars[i] === expected) continue;
    const changed = i >= prevChars.length || prevChars[i] !== nextChars[i];
    if (changed) newlyWrong.push(i);
  }
  const wubi =
    newlyWrong.length === 1 && /^[a-z]{1,4}$/i.test(wubiBuffer.value)
      ? wubiBuffer.value.toLowerCase()
      : undefined;
  for (const index of newlyWrong) {
    emit("mistake", { character: expectedChars[index], wubiCode: wubi, index });
  }
};

const onCompositionStart = () => {
  composing.value = true;
  wubiBuffer.value = "";
};

const onCompositionEnd = (event: CompositionEvent) => {
  const committed = Boolean(event.data);
  const justPlayedKey = Date.now() - lastKeySoundAt < 160;
  if (committed && !justPlayedKey) {
    playSrc(SOUND.enter);
  }
  void nextTick(() => {
    composing.value = false;
  });
};

const onKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const imeActive = composing.value || event.isComposing;
  if (imeActive && /^[a-zA-Z]$/.test(event.key) && wubiBuffer.value.length < 4) {
    wubiBuffer.value += event.key.toLowerCase();
  }
  const mapped = keyFromEvent(event);
  if (!mapped) return;
  lastKeySoundAt = Date.now();
  playTypeSound(mapped);
};

watch(volume, (value) => {
  applyVolume(value);
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
  } catch {
    // ignore storage failures
  }
});

watch(
  () => props.targetText,
  () => {
    typedText.value = "";
    committedText.value = "";
    wubiBuffer.value = "";
    clearHints();
  }
);

watch(
  () => [typedText.value, composing.value] as const,
  ([next, isComposing]) => {
    if (isComposing) return;
    detectMistakes(committedText.value, next);
    committedText.value = next;
    wubiBuffer.value = "";
  }
);

watch(currentIndex, () => {
  void nextTick(() => {
    requestAnimationFrame(ensureCurrentVisible);
  });
});

const focusInput = async () => {
  await nextTick();
  inputRef.value?.focus();
};

const onCharClick = (payload: { index: number; character: string }) => {
  const { index, character } = payload;
  if (shownHintIndex.value === index) {
    shownHintIndex.value = null;
    hintLoading.value = false;
    void focusInput();
    return;
  }
  shownHintIndex.value = index;
  hintLoading.value = !hintByIndex.value[index];
  if (!props.disabled) {
    const cached = hintByIndex.value[index] ?? wubiCache.get(character);
    emit("mistake", { character, wubiCode: cached?.code, index });
  }
  void requestHint(index, character).finally(() => {
    void focusInput();
  });
};

const resetTyped = async () => {
  typedText.value = "";
  committedText.value = "";
  clearHints();
  await focusInput();
};

const bindNativeIme = () => {
  const root = (inputRef.value as unknown as { $el?: HTMLElement } | null)?.$el;
  nativeInput = root?.querySelector("input, textarea") ?? null;
  nativeInput?.addEventListener("compositionstart", onCompositionStart);
  nativeInput?.addEventListener("compositionend", onCompositionEnd as EventListener);
};

const unbindNativeIme = () => {
  nativeInput?.removeEventListener("compositionstart", onCompositionStart);
  nativeInput?.removeEventListener("compositionend", onCompositionEnd as EventListener);
  nativeInput = null;
};

onMounted(async () => {
  ensureAllPools();
  await nextTick();
  bindNativeIme();
  void focusInput();
});

onUnmounted(() => {
  unbindNativeIme();
  for (const pool of audioPools.values()) {
    for (const audio of pool) {
      audio.pause();
      audio.src = "";
    }
  }
  audioPools.clear();
  poolIndexes.clear();
});

defineExpose({ focusInput, resetTyped });
</script>

<template>
  <n-space vertical size="large">
    <p class="hint">对照上方文字输入。正确为绿色，错误为红色，当前字符有下划线。点击汉字可在下方查看五笔编码和字根。</p>
    <div ref="targetRef" class="target" aria-label="需要输入的文字">
      <TypingPracticeChunk
        v-for="(chunk, chunkIndex) in chunks"
        :key="chunk.start"
        :chars="chunk.chars"
        :clickable="chunk.clickable"
        :start-index="chunk.start"
        :typed="chunkTyped[chunkIndex] ?? ''"
        :has-cursor="cursorChunkStart === chunk.start"
        :hint-index="hintIndexForChunk(chunk.start, chunk.chars.length)"
        @char-click="onCharClick"
      />
    </div>
    <div class="wubi-bar" aria-live="polite">
      <template v-if="shownHintIndex != null">
        <span class="wubi-bar__char">{{ shownHintChar }}</span>
        <span v-if="hintLoading && !activeHint">查询中…</span>
        <template v-else-if="activeHint">
          <span>五笔 {{ activeHint.code }}</span>
          <span v-if="activeHint.roots.length">字根 {{ activeHint.roots.join(" ") }}</span>
        </template>
        <span v-else>暂无五笔编码</span>
      </template>
      <span v-else>点击汉字查看五笔编码和字根</span>
    </div>
    <n-input
      ref="inputRef"
      v-model:value="typedText"
      type="textarea"
      size="large"
      placeholder="在这里开始打字"
      :disabled="disabled"
      :autosize="{ minRows: 2, maxRows: 3 }"
      :status="isFinished ? 'success' : undefined"
      @keydown="onKeydown"
    />
    <n-space align="center" :wrap="true">
      <span class="meta volume-label">音量 {{ Math.round(volume * 100) }}%</span>
      <n-slider v-model:value="volume" :min="0" :max="1" :step="0.01" class="volume-slider" />
    </n-space>
    <n-space align="center" justify="space-between">
      <span class="meta">准确率 {{ accuracy }}% · {{ typedChars.length }}/{{ targetChars.length }}</span>
      <n-space>
        <n-button size="small" @click="previewSounds">试听</n-button>
        <n-button :disabled="disabled" @click="resetTyped">重打</n-button>
      </n-space>
    </n-space>
    <p v-if="isFinished" class="done">已对照原文打完，请点击「完成练习」提交成绩。</p>
  </n-space>
</template>

<style scoped>
.hint,
.meta,
.done {
  margin: 0;
  color: rgba(127, 127, 127, 0.95);
  font-size: 13px;
}

.target {
  --target-line: 1.7em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;
  font-size: 22px;
  line-height: 1.7;
  letter-spacing: 0.02em;
  max-height: calc(var(--target-line) * 5 + 24px);
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  background: rgba(127, 127, 127, 0.06);
  word-break: break-word;
  scrollbar-gutter: stable;
}

.wubi-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(32, 128, 240, 0.28);
  background: rgba(32, 128, 240, 0.08);
  color: rgba(127, 127, 127, 0.95);
  font-size: 14px;
  line-height: 1.4;
}

.wubi-bar__char {
  min-width: 1.4em;
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
}

.done {
  color: #18a058;
  font-weight: 600;
}

.volume-label {
  flex: none;
  min-width: 72px;
}

.volume-slider {
  width: 180px;
}
</style>
