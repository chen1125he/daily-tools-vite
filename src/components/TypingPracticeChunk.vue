<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  chars: string[];
  clickable: boolean[];
  startIndex: number;
  typed: string;
  hasCursor: boolean;
  hintIndex: number | null;
}>();

const emit = defineEmits<{
  charClick: [payload: { index: number; character: string }];
}>();

const items = computed(() => {
  const typed = [...props.typed];
  return props.chars.map((char, offset) => {
    const index = props.startIndex + offset;
    let status: "pending" | "current" | "correct" | "wrong" = "pending";
    if (offset < typed.length) {
      status = typed[offset] === char ? "correct" : "wrong";
    } else if (props.hasCursor && offset === typed.length) {
      status = "current";
    }
    return {
      index,
      char,
      clickable: props.clickable[offset] === true,
      display: char === " " ? "\u00A0" : char === "\n" ? "" : char,
      className: [
        `is-${status}`,
        char === "\n" ? "is-newline" : "",
        props.clickable[offset] ? "is-clickable" : "",
        props.hintIndex === index ? "has-hint" : ""
      ]
    };
  });
});

const onClick = (index: number, character: string, clickable: boolean) => {
  if (!clickable) return;
  emit("charClick", { index, character });
};
</script>

<template>
  <span class="target__chunk">
    <span
      v-for="item in items"
      :key="item.index"
      class="target__char"
      :class="item.className"
      :data-index="item.index"
      @click.stop="onClick(item.index, item.char, item.clickable)"
    >{{ item.display }}</span>
  </span>
</template>

<style scoped>
.target__chunk {
  display: contents;
}

.target__char {
  display: inline-block;
  min-width: 0.45em;
}

.target__char.is-clickable {
  cursor: pointer;
}

.target__char.has-hint {
  box-shadow: inset 0 -2px 0 rgba(32, 128, 240, 0.55);
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
</style>
