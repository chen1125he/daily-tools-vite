<script setup lang="ts">
import axios from "axios";
import { NButton, NCard, NDataTable, NPopconfirm, NSpace, useMessage, type DataTableColumns } from "naive-ui";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { deleteRecipe, listRecipes, type Recipe } from "../../api/modules/recipes";

const router = useRouter();
const message = useMessage();

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("zh-CN", { hour12: false });
}

function minutesLabel(prep: number | null | undefined, cook: number | null | undefined): string {
  const parts: string[] = [];
  if (prep != null && Number.isFinite(prep)) parts.push(`备菜 ${prep} 分`);
  if (cook != null && Number.isFinite(cook)) parts.push(`烹饪 ${cook} 分`);
  return parts.length ? parts.join(" · ") : "—";
}

function ingredientsSummary(recipe: Recipe): string {
  const list = recipe.recipe_ingredients ?? [];
  if (list.length === 0) return "—";
  const names = list.map((r) => r.ingredient?.name).filter(Boolean) as string[];
  if (names.length <= 3) return names.join("、");
  return `${names.slice(0, 3).join("、")} 等 ${list.length} 项`;
}

const loading = ref(false);
const recipes = ref<Recipe[]>([]);
const deletingId = ref<number | null>(null);

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchRecipes();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchRecipes();
  }
});

const columns: DataTableColumns<Recipe> = [
  {
    title: "标题",
    key: "title",
    ellipsis: { tooltip: true },
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          type: "primary",
          onClick: () => router.push(`/recipes/${row.id}`)
        },
        { default: () => row.title }
      )
  },
  {
    title: "食材",
    key: "recipe_ingredients",
    width: 220,
    ellipsis: { tooltip: true },
    render: (row) => ingredientsSummary(row)
  },
  {
    title: "时长",
    key: "minutes",
    width: 160,
    render: (row) => minutesLabel(row.prep_minutes, row.cook_minutes)
  },
  {
    title: "更新时间",
    key: "updated_at",
    width: 180,
    render: (row) => formatTime(row.updated_at)
  },
  {
    title: "操作",
    key: "actions",
    width: 240,
    render: (row) =>
      h(
        NSpace,
        { size: "small" },
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                onClick: () => router.push(`/recipes/${row.id}`)
              },
              { default: () => "详情" }
            ),
            h(
              NButton,
              {
                size: "small",
                onClick: () => router.push(`/recipes/${row.id}/edit`)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row)
              },
              {
                default: () => `确定删除「${row.title}」吗？`,
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: "small",
                      type: "error",
                      ghost: true,
                      loading: deletingId.value === row.id
                    },
                    { default: () => "删除" }
                  )
              }
            )
          ]
        }
      )
  }
];

const fetchRecipes = async () => {
  loading.value = true;
  try {
    const res = await listRecipes({
      page: pagination.page,
      limit: pagination.pageSize
    });
    recipes.value = res.items;
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食谱列表失败"));
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (recipe: Recipe) => {
  deletingId.value = recipe.id;
  try {
    await deleteRecipe(recipe.id);
    message.success(`已删除「${recipe.title}」`);
    await fetchRecipes();
  } catch (error) {
    message.error(apiErrorMessage(error, "删除食谱失败"));
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  void fetchRecipes();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="食谱管理">
        <n-space vertical size="medium" class="content-stack">
          <n-space justify="space-between" wrap>
            <n-space>
              <n-button type="default" @click="router.push('/tools')">返回功能页</n-button>
              <n-button type="primary" @click="router.push('/recipes/create')">新建食谱</n-button>
              <n-button type="default" @click="router.push('/recipes/parse')">AI 识别菜谱</n-button>
              <n-button type="default" @click="router.push('/recipes/ingredients')">食材管理</n-button>
              <n-button type="default" @click="router.push('/menus')">菜单管理</n-button>
            </n-space>
          </n-space>
          <n-data-table
            remote
            :columns="columns"
            :data="recipes"
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
