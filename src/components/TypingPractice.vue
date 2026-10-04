<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { NButton, NInput, NSlider, NSpace } from "naive-ui";

const props = withDefaults(
  defineProps<{
    targetText: string;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const emit = defineEmits<{
  mistake: [payload: { character: string; wubiCode?: string; index: number }];
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
const volume = ref(readStoredVolume());
const audioPools = new Map<string, HTMLAudioElement[]>();
const poolIndexes = new Map<string, number>();
let nativeInput: HTMLInputElement | HTMLTextAreaElement | null = null;
let lastKeySoundAt = 0;

const comparisonText = computed(() => (composing.value ? committedText.value : typedText.value));

const chars = computed(() => {
  const target = [...props.targetText];
  const typed = [...comparisonText.value];
  return target.map((char, index) => {
    const typedChar = typed[index];
    let status: "pending" | "current" | "correct" | "wrong" = "pending";
    if (index < typed.length) {
      status = typedChar === char ? "correct" : "wrong";
    } else if (index === typed.length) {
      status = "current";
    }
    return { char, status };
  });
});

const isFinished = computed(() => {
  const target = [...props.targetText];
  const typed = [...comparisonText.value];
  return target.length > 0 && typed.length >= target.length && typed.every((char, index) => char === target[index]);
});

const accuracy = computed(() => {
  const typed = [...comparisonText.value];
  if (!typed.length) return 100;
  const target = [...props.targetText];
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
  const targetChars = [...props.targetText];
  const newlyWrong: number[] = [];
  const len = Math.min(nextChars.length, targetChars.length);
  for (let i = 0; i < len; i += 1) {
    const expected = targetChars[i];
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
    emit("mistake", { character: targetChars[index], wubiCode: wubi, index });
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

const focusInput = async () => {
  await nextTick();
  inputRef.value?.focus();
};

const resetTyped = async () => {
  typedText.value = "";
  committedText.value = "";
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
    <p class="hint">对照上方文字输入。正确为绿色，错误为红色，当前字符有下划线。</p>
    <div class="target" aria-label="需要输入的文字">
      <span
        v-for="(item, index) in chars"
        :key="`${item.char}-${index}`"
        class="target__char"
        :class="[`is-${item.status}`, item.char === '\n' ? 'is-newline' : '']"
      >{{ item.char === " " ? "\u00A0" : item.char === "\n" ? "" : item.char }}</span>
    </div>
    <n-input
      ref="inputRef"
      v-model:value="typedText"
      type="textarea"
      size="large"
      placeholder="在这里开始打字"
      :disabled="disabled"
      :autosize="{ minRows: 3, maxRows: 8 }"
      :status="isFinished ? 'success' : undefined"
      @keydown="onKeydown"
    />
    <n-space align="center" :wrap="true">
      <span class="meta volume-label">音量 {{ Math.round(volume * 100) }}%</span>
      <n-slider v-model:value="volume" :min="0" :max="1" :step="0.01" class="volume-slider" />
    </n-space>
    <n-space align="center" justify="space-between">
      <span class="meta">准确率 {{ accuracy }}% · {{ [...comparisonText].length }}/{{ [...targetText].length }}</span>
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;
  font-size: 22px;
  line-height: 1.7;
  letter-spacing: 0.02em;
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  background: rgba(127, 127, 127, 0.06);
  word-break: break-word;
}

.target__char {
  display: inline-block;
  min-width: 0.45em;
}

.target__char.is-newline {
  display: block;
  min-width: 0;
  height: 0;
}

.target__char.is-correct {
  color: #18a058;
}

.target__char.is-wrong {
  color: #d03050;
  background: rgba(208, 48, 80, 0.12);
  border-radius: 3px;
}

.target__char.is-current {
  border-bottom: 2px solid #2080f0;
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
