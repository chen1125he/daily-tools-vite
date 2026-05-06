<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSpin,
  useMessage,
  type FormRules,
  type SelectOption
} from "naive-ui";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { listIngredients } from "../../api/modules/ingredients";
import type { Ingredient } from "../../api/modules/ingredients";
import {
  createRecipe,
  getRecipe,
  updateRecipe,
  type RecipeIngredientAttribute,
  type RecipeIngredientRole
} from "../../api/modules/recipes";
import VditorDemo from "../../components/VditorDemo.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const ROLE_OPTIONS: SelectOption[] = [
  { label: "主料", value: "main" },
  { label: "辅料", value: "side" },
  { label: "调料", value: "condiment" }
];

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

interface IngredientLineForm {
  key: string;
  rowId?: number;
  ingredient_id: number | null;
  role: RecipeIngredientRole;
  amount: string;
}

/** 用户从列表移除的已有 recipe_ingredient；保存时用于 _destroy 或与「新加的同 ingredient_id 行」合并为就地更新 */
interface RemovedRecipeIngredientRow {
  rowId: number;
  ingredient_id: number | null;
}

let lineKeySeq = 0;
function nextLineKey(): string {
  lineKeySeq += 1;
  return `ri-${lineKeySeq}`;
}

const isEdit = computed(() => route.name === "recipes-edit");

/** 切换新建/不同食谱时强制重建 Vditor，避免实例残留内容 */
const vditorSessionKey = computed(() =>
  isEdit.value ? `edit-${String(route.params.id)}` : "create"
);

const pageLoading = ref(false);
const saving = ref(false);
const ingredients = ref<Ingredient[]>([]);
const ingredientsLoading = ref(false);
const editingRecipeId = ref<number | null>(null);
const formRef = ref<InstanceType<typeof NForm> | null>(null);
const removedRows = ref<RemovedRecipeIngredientRow[]>([]);
const ingredientLines = ref<IngredientLineForm[]>([]);

const formModel = reactive({
  title: "",
  prep_description: "",
  cook_description: "",
  prep_minutes: null as number | null,
  cook_minutes: null as number | null
});

const formRules: FormRules = {
  title: [
    {
      required: true,
      trigger: ["blur", "input"],
      validator: (_rule, value: string) => {
        if (!value || !String(value).trim()) {
          return new Error("请输入食谱标题");
        }
        return true;
      }
    }
  ]
};

const ingredientSelectOptions = computed<SelectOption[]>(() =>
  ingredients.value.map((i) => ({ label: i.name, value: i.id }))
);

function resetForm() {
  formModel.title = "";
  formModel.prep_description = "";
  formModel.cook_description = "";
  formModel.prep_minutes = null;
  formModel.cook_minutes = null;
  ingredientLines.value = [];
  removedRows.value = [];
  editingRecipeId.value = null;
}

const fetchIngredients = async () => {
  ingredientsLoading.value = true;
  try {
    const res = await listIngredients({ page: 1, limit: 100 });
    ingredients.value = res.items;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食材选项失败"));
  } finally {
    ingredientsLoading.value = false;
  }
};

const loadRecipeForRoute = async () => {
  if (!isEdit.value) {
    resetForm();
    return;
  }

  const id = Number(route.params.id);
  if (!Number.isFinite(id)) {
    message.error("无效的食谱 ID");
    void router.replace("/recipes");
    return;
  }

  pageLoading.value = true;
  try {
    const recipe = await getRecipe(id);
    editingRecipeId.value = recipe.id;
    formModel.title = recipe.title;
    formModel.prep_description = recipe.prep_description ?? "";
    formModel.cook_description = recipe.cook_description ?? "";
    formModel.prep_minutes = recipe.prep_minutes;
    formModel.cook_minutes = recipe.cook_minutes;
    removedRows.value = [];
    ingredientLines.value = (recipe.recipe_ingredients ?? []).map((ri) => ({
      key: nextLineKey(),
      rowId: ri.id,
      ingredient_id: ri.ingredient.id,
      role: ri.role,
      amount: ri.amount ?? ""
    }));
  } catch (error) {
    message.error(apiErrorMessage(error, "加载食谱详情失败"));
    void router.replace("/recipes");
  } finally {
    pageLoading.value = false;
  }
};

watch(
  () => [route.name, route.params.id] as const,
  () => {
    void loadRecipeForRoute();
  },
  { immediate: true }
);

const addIngredientLine = () => {
  ingredientLines.value.push({
    key: nextLineKey(),
    ingredient_id: null,
    role: "main",
    amount: ""
  });
};

const removeIngredientLine = (index: number) => {
  const line = ingredientLines.value[index];
  if (line?.rowId != null) {
    removedRows.value.push({ rowId: line.rowId, ingredient_id: line.ingredient_id });
  }
  ingredientLines.value.splice(index, 1);
};

/**
 * 构造 nested attributes：
 * - 仍显示的已有行：按 id 更新；
 * - 无 id 的新行：若与某条「已移除」行的 ingredient_id 相同，则改为带该 id 的更新（避免 _destroy + insert 同食材触发校验冲突）；
 * - 其余已移除且未被复用的行：_destroy。
 */
function buildNestedAttributes(): RecipeIngredientAttribute[] | undefined {
  const pendingDestroy = new Map<number, number | null>();
  for (const r of removedRows.value) {
    pendingDestroy.set(r.rowId, r.ingredient_id);
  }

  const usedRestoredIds = new Set<number>();
  const attrs: RecipeIngredientAttribute[] = [];
  const filled = ingredientLines.value.filter((l) => l.ingredient_id != null);

  for (const line of filled) {
    const amount = line.amount.trim();
    const amountVal = amount.length ? amount : null;
    const ingId = line.ingredient_id!;

    if (line.rowId != null) {
      attrs.push({
        id: line.rowId,
        ingredient_id: ingId,
        role: line.role,
        amount: amountVal
      });
      continue;
    }

    let restoredId: number | null = null;
    for (const [rid, oldIngId] of pendingDestroy) {
      if (usedRestoredIds.has(rid)) continue;
      if (oldIngId === ingId) {
        restoredId = rid;
        break;
      }
    }

    if (restoredId != null) {
      usedRestoredIds.add(restoredId);
      pendingDestroy.delete(restoredId);
      attrs.push({
        id: restoredId,
        ingredient_id: ingId,
        role: line.role,
        amount: amountVal
      });
    } else {
      attrs.push({
        ingredient_id: ingId,
        role: line.role,
        amount: amountVal
      });
    }
  }

  for (const rowId of pendingDestroy.keys()) {
    attrs.push({ id: rowId, _destroy: true });
  }

  if (attrs.length === 0) return undefined;
  return attrs;
}

function buildPayload() {
  const nested = buildNestedAttributes();
  return {
    title: formModel.title.trim(),
    prep_description: formModel.prep_description.trim() || null,
    cook_description: formModel.cook_description.trim() || null,
    prep_minutes: formModel.prep_minutes,
    cook_minutes: formModel.cook_minutes,
    ...(nested ? { recipe_ingredients_attributes: nested } : {})
  };
}

const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  saving.value = true;
  const payload = buildPayload();
  try {
    if (editingRecipeId.value == null) {
      await createRecipe(payload);
      message.success("食谱已创建");
    } else {
      await updateRecipe(editingRecipeId.value, payload);
      message.success("食谱已更新");
    }
    void router.push("/recipes");
  } catch (error) {
    message.error(
      apiErrorMessage(error, editingRecipeId.value == null ? "创建食谱失败" : "更新食谱失败")
    );
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  void fetchIngredients();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card :title="isEdit ? '编辑食谱' : '新建食谱'">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/recipes')">返回食谱列表</n-button>

          <n-spin v-if="pageLoading" class="spin-wrap" />
          <template v-else>
            <div class="form-body">
              <n-form ref="formRef" :model="formModel" :rules="formRules" label-placement="top">
                <n-form-item path="title" label="标题">
                  <n-input v-model:value="formModel.title" placeholder="例如：番茄炒蛋" maxlength="200" show-count />
                </n-form-item>
                <n-form-item label="备菜说明">
                  <VditorDemo
                    :key="`${vditorSessionKey}-prep`"
                    v-model="formModel.prep_description"
                    mode="ir"
                    :min-height="280"
                  />
                </n-form-item>
                <n-form-item label="烹饪说明">
                  <VditorDemo
                    :key="`${vditorSessionKey}-cook`"
                    v-model="formModel.cook_description"
                    mode="ir"
                    :min-height="280"
                  />
                </n-form-item>
                <n-space class="minutes-row" item-style="flex: 1">
                  <n-form-item label="备菜时长（分钟）">
                    <n-input-number
                      v-model:value="formModel.prep_minutes"
                      :min="0"
                      :precision="0"
                      placeholder="可选"
                      clearable
                      style="width: 100%"
                    />
                  </n-form-item>
                  <n-form-item label="烹饪时长（分钟）">
                    <n-input-number
                      v-model:value="formModel.cook_minutes"
                      :min="0"
                      :precision="0"
                      placeholder="可选"
                      clearable
                      style="width: 100%"
                    />
                  </n-form-item>
                </n-space>

                <div class="section-label">食材关联</div>
                <p class="section-hint">
                  从食材库选择并填写角色与用量；保存时会提交嵌套属性。若删掉一行后又加回同一食材，保存时会合并为更新原关联记录而非先删后建。食材选项最多加载前 100 条，可在食材管理中补充。
                </p>
                <div v-if="ingredientLines.length === 0" class="lines-empty">暂无食材行，可点击下方按钮添加。</div>
                <div v-for="(line, idx) in ingredientLines" :key="line.key" class="ingredient-line">
                  <n-select
                    v-model:value="line.ingredient_id"
                    :options="ingredientSelectOptions"
                    placeholder="选择食材"
                    filterable
                    clearable
                    :loading="ingredientsLoading"
                    class="ingredient-line__select"
                  />
                  <n-select v-model:value="line.role" :options="ROLE_OPTIONS" placeholder="角色" class="ingredient-line__role" />
                  <n-input v-model:value="line.amount" placeholder="用量（可选）" class="ingredient-line__amount" />
                  <n-button quaternary type="error" @click="removeIngredientLine(idx)">移除</n-button>
                </div>
                <n-button dashed block class="add-line-btn" @click="addIngredientLine">添加食材行</n-button>

                <n-space justify="end" class="form-actions">
                  <n-button @click="router.push('/recipes')">取消</n-button>
                  <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
                </n-space>
              </n-form>
            </div>
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

.form-body {
  padding-right: 4px;
}

.minutes-row {
  width: 100%;
}

.section-label {
  font-weight: 600;
  margin-bottom: 4px;
}

.section-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.lines-empty {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 8px;
}

.ingredient-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.ingredient-line__select {
  flex: 1 1 200px;
  min-width: 160px;
}

.ingredient-line__role {
  width: 120px;
}

.ingredient-line__amount {
  flex: 1 1 140px;
  min-width: 120px;
}

.add-line-btn {
  margin-top: 4px;
}

.form-actions {
  margin-top: 20px;
  width: 100%;
}
</style>
