<script setup lang="ts">
import axios from "axios";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NForm, NFormItem, NInput, NSpace, useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { signIn } from "../api/modules/auth";

const router = useRouter();
const message = useMessage();
const formRef = ref<FormInst | null>(null);
const formValue = reactive({
  phone: "",
  password: ""
});
const isSubmitting = ref(false);

const phonePattern = /^1[3-9]\d{9}$/;

const rules: FormRules = {
  phone: [
    {
      validator: (_rule: unknown, value: string | undefined) => {
        const normalized = value?.trim?.() || "";
        if (!normalized) {
          return new Error("请输入手机号");
        }
        if (!phonePattern.test(normalized)) {
          return new Error("手机号格式不正确");
        }
        return true;
      },
      trigger: ["blur"]
    }
  ],
  password: [
    {
      required: true,
      message: "请输入密码",
      trigger: ["blur"]
    }
  ]
};

const handleLogin = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  isSubmitting.value = true;
  try {
    const data = await signIn({
      phone: formValue.phone.trim(),
      password: formValue.password
    });
    message.success(data.message || `欢迎回来，${data.user.name}`);
    router.push("/tools");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        "登录失败，请检查手机号或密码。";
      message.error(errorMessage);
    } else {
      message.error("登录失败，请稍后重试。");
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <main class="page">
    <n-card title="登录" class="login-card">
      <n-form
        ref="formRef"
        :model="formValue"
        :rules="rules"
        label-placement="top"
        @submit.prevent="handleLogin"
        :show-require-mark="false"
      >
        <n-space vertical size="medium">
          <n-form-item label="手机号" path="phone">
            <n-input
              v-model:value="formValue.phone"
              type="text"
              inputmode="tel"
              placeholder="请输入手机号"
              autocomplete="tel"
            />
          </n-form-item>

          <n-form-item label="密码" path="password">
            <n-input
              v-model:value="formValue.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
          </n-form-item>

          <n-button attr-type="submit" type="primary" block :loading="isSubmitting">
            登录
          </n-button>
        </n-space>
      </n-form>
    </n-card>
  </main>
</template>

<style scoped>
.page {
  min-height: calc(100vh - 86px);
  display: grid;
  place-items: center;
}

.login-card {
  width: min(100vw - 32px, 420px);
}
</style>
