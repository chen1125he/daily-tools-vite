<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NSpin, useMessage } from "naive-ui";
import { getRecipe, type Recipe } from "../../api/modules/recipes";
import MarkdownPreview from "../../components/MarkdownPreview.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const recipe = ref<Recipe | null>(null);

const recipeId = computed(() => Number(route.params.id));
const isInvalidId = computed(() => !Number.isInteger(recipeId.value) || recipeId.value <= 0);

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

const fetchRecipe = async () => {
  if (isInvalidId.value) {
    message.error("食谱 ID 不合法");
    void router.replace("/recipes");
    return;
  }

  loading.value = true;
  try {
    recipe.value = await getRecipe(recipeId.value);
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食谱详情失败"));
    void router.replace("/recipes");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void fetchRecipe();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-spin :show="loading">
        <n-card v-if="recipe" :title="recipe.title" style="width: 100%">
          <n-space vertical size="medium" class="content-stack">
            <n-space wrap>
              <n-button quaternary @click="router.push('/recipes')">返回列表</n-button>
              <n-button type="primary" @click="router.push(`/recipes/${recipe.id}/edit`)">编辑</n-button>
            </n-space>

            <section class="recipe-body">
              <markdown-preview
                v-if="recipe.full_recipe_text?.trim()"
                :content="recipe.full_recipe_text"
              />
              <n-empty v-else description="暂无完整菜谱文本" />
            </section>
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

.recipe-body__title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}
</style>
