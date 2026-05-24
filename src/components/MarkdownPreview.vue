<script setup lang="ts">
import Vditor from "vditor";
import "vditor/dist/index.css";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

/** 只读 Markdown 渲染，基于 Vditor.preview */
defineOptions({ name: "MarkdownPreview" });

const props = withDefaults(
  defineProps<{
    content: string;
  }>(),
  {
    content: ""
  }
);

const hostEl = ref<HTMLDivElement | null>(null);
let renderSeq = 0;
let themeMedia: MediaQueryList | null = null;

function previewMode(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const render = async () => {
  const el = hostEl.value;
  if (!el) return;

  const seq = ++renderSeq;
  const markdown = props.content ?? "";

  if (!markdown.trim()) {
    el.innerHTML = "";
    el.classList.remove("vditor-reset");
    return;
  }

  await Vditor.preview(el, markdown, {
    mode: previewMode(),
    lang: "zh_CN"
  });

  if (seq !== renderSeq) return;
};

const handleThemeChange = () => {
  void render();
};

onMounted(() => {
  themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  themeMedia.addEventListener("change", handleThemeChange);
  void render();
});

watch(
  () => props.content,
  () => {
    void render();
  }
);

onBeforeUnmount(() => {
  themeMedia?.removeEventListener("change", handleThemeChange);
  themeMedia = null;
  renderSeq += 1;
  if (hostEl.value) {
    hostEl.value.innerHTML = "";
    hostEl.value.classList.remove("vditor-reset");
  }
});
</script>

<template>
  <div ref="hostEl" class="markdown-preview" />
</template>

<style scoped>
.markdown-preview :deep(.vditor-reset) {
  padding: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}
</style>
