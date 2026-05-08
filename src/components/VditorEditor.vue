<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import Vditor from "vditor";
import "vditor/dist/index.css";

/** 基于 Vditor 的 Markdown 编辑器，支持 v-model（内容为 Markdown 字符串） */
defineOptions({ name: "VditorEditor" });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    mode?: "ir" | "wysiwyg" | "sv";
    minHeight?: number;
    /** 工具栏按钮悬停多久后显示功能说明（Vditor 自带 tooltip，这里只控制出现前的等待时间） */
    tooltipHoverDelayMs?: number;
  }>(),
  {
    tooltipHoverDelayMs: 500
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const hostEl = ref<HTMLElement | null>(null);
let vditor: Vditor | null = null;
let lastEmitted = "";
let toolbarObserver: MutationObserver | null = null;

onMounted(() => {
  if (!hostEl.value) return;
  const minHeight = props.minHeight ?? 320;

  const applyToolbarNativeTitles = () => {
    const root = hostEl.value;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>(".vditor-toolbar .vditor-tooltipped[aria-label]")
      .forEach((el) => {
        const label = el.getAttribute("aria-label");
        if (!label) return;
        // 让浏览器原生 tooltip 兜底（hover 一会儿显示），避免小屏时 Vditor 自带 tooltip 被关闭
        const currentTitle = el.getAttribute("title");
        if (currentTitle === label) return;
        el.setAttribute("title", label);
      });
  };

  vditor = new Vditor(hostEl.value, {
    lang: "zh_CN",
    mode: props.mode ?? "ir",
    height: minHeight,
    cache: { enable: false },
    toolbarConfig: { pin: false },
    preview: { mode: "both" },
    input: (value) => {
      lastEmitted = value;
      emit("update:modelValue", value);
    },
    after: () => {
      vditor?.setValue(props.modelValue ?? "");
      applyToolbarNativeTitles();

      const toolbarEl = hostEl.value?.querySelector(".vditor-toolbar");
      if (toolbarEl) {
        toolbarObserver?.disconnect();
        toolbarObserver = new MutationObserver(() => applyToolbarNativeTitles());
        // 只监听节点增删，避免“监听 attributes + 回调里 setAttribute”导致循环触发卡死
        toolbarObserver.observe(toolbarEl, { subtree: true, childList: true });
      }
    }
  });
});

watch(
  () => props.modelValue,
  (next) => {
    if (!vditor) return;
    const desired = next ?? "";
    if (desired === lastEmitted) return;
    if (vditor.getValue() === desired) return;
    vditor.setValue(desired);
  }
);

onBeforeUnmount(() => {
  toolbarObserver?.disconnect();
  toolbarObserver = null;
  vditor?.destroy();
  vditor = null;
});
</script>

<template>
  <div
    class="vditor-wrap"
    :style="{ '--vditor-toolbar-tooltip-delay': `${tooltipHoverDelayMs}ms` }"
  >
    <div ref="hostEl" />
  </div>
</template>

<style scoped>
.vditor-wrap :deep(.vditor) {
  border: 1px solid rgba(127, 127, 127, 0.35);
  border-radius: 10px;
  overflow: hidden;
}

/*
 * Vditor 工具栏按钮已有「功能说明」：button.vditor-tooltipped 的 aria-label + 伪元素 tooltip。
 * 默认 hover 后几乎立刻出现；这里给动画加 delay，实现「悬停一小会儿再显示」。
 */
.vditor-wrap :deep(.vditor-toolbar .vditor-tooltipped:hover::after),
.vditor-wrap :deep(.vditor-toolbar .vditor-tooltipped:hover::before) {
  animation-delay: var(--vditor-toolbar-tooltip-delay, 0.5s);
}
</style>
