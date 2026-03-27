<script setup lang="ts">
import axios from "axios";
import { reactive, ref, watch } from "vue";
import { NButton, NForm, NFormItem, NInput, NInputNumber, NSpace, NSwitch, useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { updateChore } from "../../api/modules/chore";
import type { Chore, ChorePayload } from "../../api/modules/chore";

const props = defineProps<{
  chore: Chore;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const updating = ref(false);
const formValue = reactive<ChorePayload>({
  name: "",
  description: "",
  default_contribution_points: 0,
  active: true
});

watch(
  () => props.chore,
  (chore) => {
    formValue.name = chore.name;
    formValue.description = chore.description;
    formValue.default_contribution_points = chore.default_contribution_points;
    formValue.active = chore.active;
  },
  { immediate: true }
);

const rules: FormRules = {
  name: [
    {
      required: true,
      message: "请输入家务名",
      trigger: ["blur"]
    }
  ],
  default_contribution_points: [
    {
      validator: (_rule: unknown, value: number | null | undefined) => {
        if (value === null || value === undefined) {
          return new Error("请输入默认贡献积分");
        }
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          return new Error("默认贡献积分必须在 0 到 100 之间");
        }
        const decimalPart = String(value).split(".")[1];
        if (decimalPart && decimalPart.length > 2) {
          return new Error("默认贡献积分最多保留两位小数");
        }
        return true;
      },
      trigger: ["blur", "input"]
    }
  ]
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  updating.value = true;
  try {
    const result = await updateChore(props.chore.id, {
      name: formValue.name.trim(),
      description: formValue.description.trim(),
      default_contribution_points: Number(formValue.default_contribution_points),
      active: formValue.active
    });
    message.success(result.message || "家务更新成功");
    emit("updated");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "更新家务失败");
    } else {
      message.error("更新家务失败");
    }
  } finally {
    updating.value = false;
  }
};
</script>

<template>
  <n-form
    ref="formRef"
    :model="formValue"
    :rules="rules"
    label-placement="top"
    :show-require-mark="false"
    @submit.prevent="handleSubmit"
  >
    <n-space vertical size="medium">
      <n-form-item label="家务名" path="name">
        <n-input v-model:value="formValue.name" placeholder="例如：洗碗" />
      </n-form-item>
      <n-form-item label="描述" path="description">
        <n-input
          v-model:value="formValue.description"
          type="textarea"
          placeholder="输入家务描述（可选）"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </n-form-item>
      <n-form-item label="默认贡献积分" path="default_contribution_points">
        <n-input-number
          v-model:value="formValue.default_contribution_points"
          :min="0"
          :max="100"
          :precision="2"
          :step="1"
          style="width: 100%"
        />
      </n-form-item>
      <n-form-item label="是否启用" path="active">
        <n-switch v-model:value="formValue.active" />
      </n-form-item>
      <n-button type="primary" attr-type="submit" :loading="updating">保存更新</n-button>
    </n-space>
  </n-form>
</template>
