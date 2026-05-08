<script setup lang="ts">
import axios from "axios";
import { NAlert, NButton, NCard, NSpace, useMessage } from "naive-ui";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { parseRecipeFromText } from "../../api/modules/recipes";
import VditorEditor from "../../components/VditorEditor.vue";

const router = useRouter();
const message = useMessage();

const recipeText = ref("");
const parsing = ref(false);

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as {
      message?: string;
      error?: { code?: string; message?: string };
    } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

const handleParse = async () => {
  const text = recipeText.value.trim();
  if (!text) {
    message.warning("请先粘贴或输入菜谱全文");
    return;
  }
  parsing.value = true;
  try {
    const recipe = await parseRecipeFromText({ text });
    message.success("已识别并创建食谱，可继续编辑用量与细节");
    void router.replace(`/recipes/${recipe.id}/edit`);
  } catch (error) {
    message.error(apiErrorMessage(error, "识别失败"));
  } finally {
    parsing.value = false;
  }
};
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="AI 识别菜谱">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/recipes')">返回食谱列表</n-button>

          <n-alert type="info" :bordered="false">
            粘贴一整段菜谱笔记（纯文本或 Markdown 均可）。服务端会解析并新建一条食谱，食材通过名称匹配或自动写入食材库；解析出的食材行通常没有用量，创建后请在编辑页补充。
          </n-alert>

          <div class="vditor-host" :class="{ 'vditor-host--busy': parsing }">
            <VditorEditor v-model="recipeText" mode="ir" :min-height="400" />
          </div>

          <n-space justify="end">
            <n-button @click="router.push('/recipes')" :disabled="parsing">取消</n-button>
            <n-button type="primary" :loading="parsing" @click="handleParse">识别并创建</n-button>
          </n-space>
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

.vditor-host {
  width: 100%;
}

.vditor-host--busy {
  pointer-events: none;
  opacity: 0.65;
}
</style>
