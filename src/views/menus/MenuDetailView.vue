<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NEmpty,
  NSpace,
  NSpin,
  NTag,
  useMessage
} from "naive-ui";
import { getMenu, type MealType, type Menu } from "../../api/modules/menus";
import type { Recipe, RecipeIngredient } from "../../api/modules/recipes";
import MarkdownPreview from "../../components/MarkdownPreview.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐"
};

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

function formatDateOnly(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("zh-CN");
}

function formatIngredientLine(item: RecipeIngredient): string {
  const name = item.ingredient?.name ?? "未知食材";
  const amount = item.amount?.trim();
  const role = item.role_label || item.role;
  const parts = [name];
  if (amount) parts.push(amount);
  return `${parts.join(" ")}（${role}）`;
}

function hasPrepContent(recipe: Recipe): boolean {
  return Boolean(recipe.prep_description?.trim());
}

function hasCookContent(recipe: Recipe): boolean {
  return Boolean(recipe.cook_description?.trim());
}

const loading = ref(false);
const menu = ref<Menu | null>(null);

const menuId = computed(() => Number(route.params.id));
const isInvalidId = computed(() => !Number.isInteger(menuId.value) || menuId.value <= 0);

const recipes = computed(() => menu.value?.recipes ?? []);

const pageTitle = computed(() => {
  if (!menu.value) return "菜单详情";
  const meal = MEAL_TYPE_LABEL[menu.value.meal_type] ?? menu.value.meal_type;
  return `${formatDateOnly(menu.value.menu_date)} · ${meal}`;
});

const fetchMenu = async () => {
  if (isInvalidId.value) {
    message.error("菜单 ID 不合法");
    void router.replace("/menus");
    return;
  }

  loading.value = true;
  try {
    menu.value = await getMenu(menuId.value);
  } catch (error) {
    message.error(apiErrorMessage(error, "加载菜单详情失败"));
    void router.replace("/menus");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void fetchMenu();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-spin :show="loading">
        <n-card v-if="menu" :title="pageTitle" style="width: 100%">
          <n-space vertical size="large" class="content-stack">
            <n-space wrap>
              <n-button quaternary @click="router.push('/menus')">返回列表</n-button>
              <n-button type="primary" @click="router.push(`/menus/${menu.id}/edit`)">编辑</n-button>
            </n-space>

            <n-descriptions label-placement="left" :column="1" bordered>
              <n-descriptions-item label="日期">
                {{ formatDateOnly(menu.menu_date) }}
              </n-descriptions-item>
              <n-descriptions-item label="餐次">
                {{ MEAL_TYPE_LABEL[menu.meal_type] ?? menu.meal_type }}
              </n-descriptions-item>
              <n-descriptions-item label="菜品">
                <n-space v-if="recipes.length > 0" wrap>
                  <n-tag v-for="recipe in recipes" :key="recipe.id" size="small">
                    {{ recipe.title }}
                  </n-tag>
                </n-space>
                <span v-else>—</span>
              </n-descriptions-item>
            </n-descriptions>

            <n-empty v-if="recipes.length === 0" description="暂无关联菜品" />

            <template v-else>
              <section class="workflow-section">
                <h3 class="section-title">1. 食材</h3>
                <p class="section-hint">本餐各道菜所需食材，备菜前可先统一准备。</p>
                <div v-for="recipe in recipes" :key="`ing-${recipe.id}`" class="recipe-block">
                  <div class="recipe-block__header">
                    <h4 class="recipe-block__title">{{ recipe.title }}</h4>
                    <n-button text type="primary" size="small" @click="router.push(`/recipes/${recipe.id}`)">
                      查看食谱
                    </n-button>
                  </div>
                  <ul v-if="recipe.recipe_ingredients?.length" class="ingredient-list">
                    <li v-for="item in recipe.recipe_ingredients" :key="item.id">
                      {{ formatIngredientLine(item) }}
                    </li>
                  </ul>
                  <p v-else class="empty-hint">暂无食材信息</p>
                </div>
              </section>

              <n-divider />

              <section class="workflow-section">
                <h3 class="section-title">2. 备菜步骤</h3>
                <p class="section-hint">切配、腌制等备菜工作，建议在开火前完成。</p>
                <template v-if="recipes.some(hasPrepContent)">
                  <div v-for="recipe in recipes" :key="`prep-${recipe.id}`" class="recipe-block">
                    <div class="recipe-block__header">
                      <h4 class="recipe-block__title">{{ recipe.title }}</h4>
                      <n-button text type="primary" size="small" @click="router.push(`/recipes/${recipe.id}`)">
                        查看食谱
                      </n-button>
                    </div>
                    <markdown-preview
                      v-if="hasPrepContent(recipe)"
                      :content="recipe.prep_description!"
                      class="markdown-block"
                    />
                    <p v-else class="empty-hint">暂无备菜说明</p>
                  </div>
                </template>
                <n-empty v-else description="本餐暂无备菜步骤" />
              </section>

              <n-divider />

              <section class="workflow-section">
                <h3 class="section-title">3. 烹饪步骤</h3>
                <p class="section-hint">开火后的烹饪流程，按各道菜依次进行。</p>
                <template v-if="recipes.some(hasCookContent)">
                  <div v-for="recipe in recipes" :key="`cook-${recipe.id}`" class="recipe-block">
                    <div class="recipe-block__header">
                      <h4 class="recipe-block__title">{{ recipe.title }}</h4>
                      <n-button text type="primary" size="small" @click="router.push(`/recipes/${recipe.id}`)">
                        查看食谱
                      </n-button>
                    </div>
                    <markdown-preview
                      v-if="hasCookContent(recipe)"
                      :content="recipe.cook_description!"
                      class="markdown-block"
                    />
                    <p v-else class="empty-hint">暂无烹饪说明</p>
                  </div>
                </template>
                <n-empty v-else description="本餐暂无烹饪步骤" />
              </section>
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

.workflow-section {
  width: 100%;
}

.section-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.section-hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.55);
}

.recipe-block {
  padding: 14px 16px;
  margin-bottom: 12px;
  border: 1px solid rgba(127, 127, 127, 0.25);
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.04);
}

.recipe-block:last-child {
  margin-bottom: 0;
}

.recipe-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.recipe-block__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.ingredient-list {
  margin: 0;
  padding-left: 1.25em;
  line-height: 1.8;
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.markdown-block {
  margin-top: 4px;
}
</style>
