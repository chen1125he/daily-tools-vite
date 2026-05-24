<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NPopconfirm,
  NSelect,
  NSpace,
  useMessage,
  type DataTableColumns,
  type SelectOption
} from "naive-ui";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { deleteMenu, listMenus, type MealType, type Menu } from "../../api/modules/menus";

const router = useRouter();
const message = useMessage();

const MEAL_TYPE_OPTIONS: SelectOption[] = [
  { label: "早餐", value: "breakfast" },
  { label: "午餐", value: "lunch" },
  { label: "晚餐", value: "dinner" }
];

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

function startOfDayTimestamp(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayTimestamp(time: number): number {
  const d = new Date(time);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function getDefaultDateRange(): [number, number] {
  const now = new Date();
  const todayStart = startOfDayTimestamp(now.getTime());
  const day = now.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return [todayStart, endOfDayTimestamp(sunday.getTime())];
}

function formatDateOnly(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("zh-CN");
}

function toIsoDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function recipesSummary(menu: Menu): string {
  const titles = (menu.recipes ?? []).map((r) => r.title).filter(Boolean);
  if (titles.length === 0) return "—";
  if (titles.length <= 3) return titles.join("、");
  return `${titles.slice(0, 3).join("、")} 等 ${titles.length} 道`;
}

const loading = ref(false);
const menus = ref<Menu[]>([]);
const deletingId = ref<number | null>(null);

const filters = reactive({
  meal_type: null as MealType | null,
  date_range: getDefaultDateRange() as [number, number] | null
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchMenus();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchMenus();
  }
});

const columns: DataTableColumns<Menu> = [
  {
    title: "日期",
    key: "menu_date",
    width: 120,
    render: (row) => formatDateOnly(row.menu_date)
  },
  {
    title: "餐次",
    key: "meal_type",
    width: 80,
    render: (row) => MEAL_TYPE_LABEL[row.meal_type] ?? row.meal_type
  },
  {
    title: "菜品",
    key: "recipes",
    ellipsis: { tooltip: true },
    render: (row) => recipesSummary(row)
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
                onClick: () => router.push(`/menus/${row.id}`)
              },
              { default: () => "详情" }
            ),
            h(
              NButton,
              {
                size: "small",
                onClick: () => router.push(`/menus/${row.id}/edit`)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row)
              },
              {
                default: () => {
                  const label = `${formatDateOnly(row.menu_date)} ${MEAL_TYPE_LABEL[row.meal_type] ?? row.meal_type}`;
                  return `确定删除「${label}」菜单吗？`;
                },
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

const fetchMenus = async () => {
  loading.value = true;
  try {
    const res = await listMenus({
      page: pagination.page,
      limit: pagination.pageSize,
      meal_type: filters.meal_type ?? undefined,
      from: filters.date_range ? toIsoDateString(filters.date_range[0]) : undefined,
      to: filters.date_range ? toIsoDateString(filters.date_range[1]) : undefined
    });
    menus.value = res.items;
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载菜单列表失败"));
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  void fetchMenus();
};

const handleResetFilters = () => {
  filters.meal_type = null;
  filters.date_range = getDefaultDateRange();
  pagination.page = 1;
  void fetchMenus();
};

const handleDelete = async (menu: Menu) => {
  deletingId.value = menu.id;
  try {
    await deleteMenu(menu.id);
    const label = `${formatDateOnly(menu.menu_date)} ${MEAL_TYPE_LABEL[menu.meal_type] ?? menu.meal_type}`;
    message.success(`已删除「${label}」`);
    await fetchMenus();
  } catch (error) {
    message.error(apiErrorMessage(error, "删除菜单失败"));
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  void fetchMenus();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="菜单管理">
        <n-space vertical size="medium" class="content-stack">
          <n-space justify="space-between" wrap>
            <n-space>
              <n-button type="default" @click="router.push('/recipes')">返回食谱管理</n-button>
              <n-button type="primary" @click="router.push('/menus/create')">新建菜单</n-button>
            </n-space>
          </n-space>

          <n-space wrap align="center" class="filters">
            <n-date-picker
              v-model:value="filters.date_range"
              type="daterange"
              clearable
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
            <n-select
              v-model:value="filters.meal_type"
              :options="MEAL_TYPE_OPTIONS"
              placeholder="餐次筛选"
              clearable
              style="width: 140px"
            />
            <n-button type="primary" @click="handleSearch">查询</n-button>
            <n-button @click="handleResetFilters">重置</n-button>
          </n-space>

          <n-data-table
            remote
            :columns="columns"
            :data="menus"
            :loading="loading"
            :pagination="pagination"
            :bordered="false"
            :scroll-x="720"
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

.filters {
  width: 100%;
}
</style>
