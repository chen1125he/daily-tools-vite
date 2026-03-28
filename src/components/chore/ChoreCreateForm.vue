<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { NButton, NForm, NFormItem, NInput, NInputNumber, NSpace, NSwitch, useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { createChore } from "../../api/modules/chore";
import type { ChorePayload } from "../../api/modules/chore";

const emit = defineEmits<{
  created: [];
}>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const creating = ref(false);
const formValue = reactive<ChorePayload>({
  name: "",
  description: "",
  search_keywords: "",
  default_points: 0,
  active: true
});

const rules: FormRules = {
  name: [
    {
      required: true,
      message: "请输入家务名",
      trigger: ["blur"]
    }
  ],
  default_points: [
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

const resetForm = () => {
  formValue.name = "";
  formValue.description = "";
  formValue.search_keywords = "";
  formValue.default_points = 0;
  formValue.active = true;
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  creating.value = true;
  try {
    const result = await createChore({
      name: formValue.name.trim(),
      description: formValue.description.trim(),
      search_keywords: formValue.search_keywords.trim(),
      default_points: Number(formValue.default_points),
      active: formValue.active
    });
    message.success(result.message || "家务创建成功");
    resetForm();
    emit("created");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "创建家务失败");
    } else {
      message.error("创建家务失败");
    }
  } finally {
    creating.value = false;
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
      <n-form-item label="搜索关键词" path="search_keywords">
        <n-input
          v-model:value="formValue.search_keywords"
          type="textarea"
          placeholder="用于匹配用户输入的别名、同义词等（可选）"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </n-form-item>
      <n-form-item label="默认贡献积分" path="default_points">
        <n-input-number
          v-model:value="formValue.default_points"
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
      <n-button type="primary" attr-type="submit" :loading="creating">创建家务</n-button>
    </n-space>
  </n-form>
</template>
