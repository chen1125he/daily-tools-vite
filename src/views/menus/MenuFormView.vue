<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NDatePicker,
  NForm,
  NFormItem,
  NSelect,
  NSpace,
  NSpin,
  useMessage,
  type FormRules,
  type SelectOption
} from "naive-ui";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createMenu, getMenu, updateMenu, type MealType } from "../../api/modules/menus";
import { listRecipes } from "../../api/modules/recipes";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const MEAL_TYPE_OPTIONS: SelectOption[] = [
  { label: "早餐", value: "breakfast" },
  { label: "午餐", value: "lunch" },
  { label: "晚餐", value: "dinner" }
];

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

function toIsoDateString(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMenuDate(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}

const isEdit = computed(() => route.name === "menus-edit");

const pageLoading = ref(false);
const saving = ref(false);
const recipesLoading = ref(false);
const editingMenuId = ref<number | null>(null);
const formRef = ref<InstanceType<typeof NForm> | null>(null);
const recipeOptions = ref<SelectOption[]>([]);

const formModel = reactive({
  menu_date: null as number | null,
  meal_type: "lunch" as MealType,
  recipe_ids: [] as number[]
});

const formRules: FormRules = {
  menu_date: [
    {
      required: true,
      trigger: ["blur", "change"],
      validator: (_rule, value: number | null) => {
        if (value == null || !Number.isFinite(value)) {
          return new Error("请选择菜单日期");
        }
        return true;
      }
    }
  ],
  meal_type: [
    {
      required: true,
      trigger: ["blur", "change"],
      message: "请选择餐次"
    }
  ]
};

function resetForm() {
  formModel.menu_date = Date.now();
  formModel.meal_type = "lunch";
  formModel.recipe_ids = [];
  editingMenuId.value = null;
}

const fetchRecipeOptions = async () => {
  recipesLoading.value = true;
  try {
    const res = await listRecipes({ page: 1, limit: 100 });
    recipeOptions.value = res.items.map((r) => ({ label: r.title, value: r.id }));
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食谱选项失败"));
  } finally {
    recipesLoading.value = false;
  }
};

const loadMenuForRoute = async () => {
  if (!isEdit.value) {
    resetForm();
    return;
  }

  const id = Number(route.params.id);
  if (!Number.isFinite(id)) {
    message.error("无效的菜单 ID");
    void router.replace("/menus");
    return;
  }

  pageLoading.value = true;
  try {
    const menu = await getMenu(id);
    editingMenuId.value = menu.id;
    formModel.menu_date = parseMenuDate(menu.menu_date);
    formModel.meal_type = menu.meal_type;
    formModel.recipe_ids = (menu.recipes ?? []).map((r) => r.id);
  } catch (error) {
    message.error(apiErrorMessage(error, "加载菜单详情失败"));
    void router.replace("/menus");
  } finally {
    pageLoading.value = false;
  }
};

watch(
  () => [route.name, route.params.id] as const,
  () => {
    void loadMenuForRoute();
  },
  { immediate: true }
);

const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (formModel.menu_date == null) return;

  saving.value = true;
  const payload = {
    menu_date: toIsoDateString(formModel.menu_date),
    meal_type: formModel.meal_type,
    recipe_ids: formModel.recipe_ids
  };

  try {
    if (editingMenuId.value == null) {
      await createMenu(payload);
      message.success("菜单已创建");
    } else {
      await updateMenu(editingMenuId.value, payload);
      message.success("菜单已更新");
    }
    void router.push("/menus");
  } catch (error) {
    message.error(apiErrorMessage(error, editingMenuId.value == null ? "创建菜单失败" : "更新菜单失败"));
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  void fetchRecipeOptions();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card :title="isEdit ? '编辑菜单' : '新建菜单'">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/menus')">返回菜单列表</n-button>

          <n-spin v-if="pageLoading" class="spin-wrap" />
          <template v-else>
            <n-form ref="formRef" :model="formModel" :rules="formRules" label-placement="top">
              <n-form-item path="menu_date" label="日期">
                <n-date-picker
                  v-model:value="formModel.menu_date"
                  type="date"
                  clearable
                  style="width: 100%"
                />
              </n-form-item>
              <n-form-item path="meal_type" label="餐次">
                <n-select v-model:value="formModel.meal_type" :options="MEAL_TYPE_OPTIONS" />
              </n-form-item>
              <n-form-item label="菜品">
                <n-select
                  v-model:value="formModel.recipe_ids"
                  :options="recipeOptions"
                  multiple
                  filterable
                  clearable
                  :loading="recipesLoading"
                  placeholder="选择本餐要做的菜"
                />
                <p class="field-hint">
                  更新时会整体替换关联菜品；编辑时若清空选择并保存，将移除所有关联食谱。
                </p>
              </n-form-item>

              <n-space justify="end" class="form-actions">
                <n-button @click="router.push('/menus')">取消</n-button>
                <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
              </n-space>
            </n-form>
          </template>
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

.spin-wrap {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.field-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.form-actions {
  margin-top: 20px;
  width: 100%;
}
</style>
