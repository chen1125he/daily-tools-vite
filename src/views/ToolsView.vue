<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace } from "naive-ui";
import VditorEditor from "../components/VditorEditor.vue";

const router = useRouter();

const vditorMd = ref(`# Vditor Demo（更像 Typora）

Vditor 的 **IR / 所见即所得** 模式，会在编辑区里直接显示格式效果。

## 试试这些

- 表格
- 任务列表
- 引用

> 这是一段引用

| A | B |
|---|---|
| 1 | 2 |

- [x] done
- [ ] todo
`);
</script>

<template>
  <main class="page">
    <n-card title="功能页" class="tools-card">
      <n-space vertical>
        <p>这里是功能入口页，你可以从这里进入具体业务模块。</p>
        <n-button type="default" @click="router.push('/recipes')">食谱管理</n-button>
        <n-button type="default" @click="router.push('/menus')">菜单管理</n-button>
        <n-button type="default" @click="router.push('/chores/records')">家务记录管理</n-button>
        <n-button type="default" @click="router.push('/login')">返回登录</n-button>
      </n-space>
    </n-card>

    <n-card title="Markdown 编辑器体验（Vditor，Typora-like）" class="demo-card">
      <n-space vertical size="large">
        <VditorEditor v-model="vditorMd" mode="ir" :min-height="360" />
        <div class="value-preview">
          <div class="value-preview__title">当前内容（v-model 同步）</div>
          <pre class="value-preview__pre">{{ vditorMd }}</pre>
        </div>
      </n-space>
    </n-card>
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.demo-card {
  max-width: 980px;
}

.value-preview {
  border: 1px solid rgba(127, 127, 127, 0.25);
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(127, 127, 127, 0.06);
}

.value-preview__title {
  font-weight: 600;
  margin-bottom: 8px;
}

.value-preview__pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.6;
}
</style>
