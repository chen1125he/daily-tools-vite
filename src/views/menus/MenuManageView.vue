<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  useMessage,
  type DataTableColumns,
  type FormRules,
  type SelectOption
} from "naive-ui";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  deleteMenu,
  generateMenus,
  listMenus,
  type MealType,
  type Menu
} from "../../api/modules/menus";

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

const generateModalVisible = ref(false);
const generating = ref(false);
const generateFormRef = ref<InstanceType<typeof NForm> | null>(null);
const generateFormModel = reactive({
  days: 1,
  start_date: null as number | null,
  custom_prompt: ""
});
const generateFormRules: FormRules = {
  start_date: [
    {
      required: true,
      trigger: ["blur", "change"],
      validator: (_rule, value: number | null) => {
        if (value == null || !Number.isFinite(value)) {
          return new Error("请选择开始日期");
        }
        return true;
      }
    }
  ],
  days: [
    {
      required: true,
      type: "number",
      message: "请填写规划天数",
      trigger: ["blur", "change"]
    },
    {
      type: "number",
      min: 1,
      max: 14,
      message: "天数须为 1～14 的正整数",
      trigger: ["blur", "change"]
    }
  ]
};

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

const openGenerateModal = () => {
  generateFormModel.days = 1;
  generateFormModel.start_date = startOfDayTimestamp(Date.now());
  generateFormModel.custom_prompt = "";
  generateModalVisible.value = true;
};

const closeGenerateModal = () => {
  if (!generating.value) {
    generateModalVisible.value = false;
  }
};

const handleGenerateMenus = async () => {
  try {
    await generateFormRef.value?.validate();
  } catch {
    return;
  }
  generating.value = true;
  const startDateIso = toIsoDateString(generateFormModel.start_date!);
  const customPrompt = generateFormModel.custom_prompt.trim();
  try {
    await generateMenus({
      days: generateFormModel.days,
      start_date: startDateIso,
      ...(customPrompt ? { custom_prompt: customPrompt } : {})
    });
    message.success(
      `已从 ${formatDateOnly(startDateIso)} 起生成 ${generateFormModel.days} 天的午/晚餐菜单`
    );
    generateModalVisible.value = false;
    pagination.page = 1;
    await fetchMenus();
  } catch (error) {
    message.error(apiErrorMessage(error, "AI 生成菜单失败"));
  } finally {
    generating.value = false;
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
              <n-button type="info" :loading="generating" @click="openGenerateModal">AI 生成菜单</n-button>
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

    <n-modal
      v-model:show="generateModalVisible"
      preset="card"
      title="AI 生成菜单"
      style="width: 520px"
      :mask-closable="!generating"
      :close-on-esc="!generating"
    >
      <n-form
        ref="generateFormRef"
        :model="generateFormModel"
        :rules="generateFormRules"
        label-placement="top"
      >
        <n-form-item path="start_date" label="开始日期">
          <n-date-picker
            v-model:value="generateFormModel.start_date"
            type="date"
            clearable
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item path="days" label="规划天数">
          <n-input-number
            v-model:value="generateFormModel.days"
            :min="1"
            :max="14"
            :precision="0"
            placeholder="1～14"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item path="custom_prompt" label="额外要求">
          <n-input
            v-model:value="generateFormModel.custom_prompt"
            type="textarea"
            placeholder="例如：本周少吃辣、晚餐尽量清淡、多安排汤类……"
            :autosize="{ minRows: 2, maxRows: 5 }"
          />
        </n-form-item>
        <p class="generate-hint">
          从所选日期起连续生成午、晚餐（午餐 2 道、晚餐 3 道），仅使用你已有的食谱；同日期同餐次若已有菜单将被覆盖。额外要求会一并交给 AI 参考。生成过程可能较慢，请勿重复提交。
        </p>
        <n-space justify="end">
          <n-button :disabled="generating" @click="closeGenerateModal">取消</n-button>
          <n-button type="primary" :loading="generating" @click="handleGenerateMenus">开始生成</n-button>
        </n-space>
      </n-form>
    </n-modal>
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

.generate-hint {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--n-text-color-3);
}
</style>
