<script setup lang="ts">
import axios from "axios";
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NSpin,
  useMessage,
  type FormRules
} from "naive-ui";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  createTypingArticle,
  getTypingArticle,
  updateTypingArticle
} from "../../api/modules/typing";

const route = useRoute();
const router = useRouter();
const message = useMessage();

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return d?.error?.message ?? d?.message ?? fallback;
  }
  return fallback;
}

const isEdit = computed(() => route.name === "typing-articles-edit");
const articleId = computed(() => Number(route.params.id));
const pageLoading = ref(false);
const saving = ref(false);
const formRef = ref<InstanceType<typeof NForm> | null>(null);

const formModel = reactive({
  title: "",
  body: ""
});

const formRules: FormRules = {
  title: [
    {
      required: true,
      trigger: ["blur", "input"],
      validator: (_rule, value: string) => {
        if (!value || !String(value).trim()) {
          return new Error("请输入标题");
        }
        return true;
      }
    }
  ],
  body: [
    {
      required: true,
      trigger: ["blur", "input"],
      validator: (_rule, value: string) => {
        if (!value || !String(value).trim()) {
          return new Error("请输入练习正文");
        }
        return true;
      }
    }
  ]
};

const resetForm = () => {
  formModel.title = "";
  formModel.body = "";
};

const loadArticle = async () => {
  if (!isEdit.value) {
    resetForm();
    return;
  }
  if (!Number.isInteger(articleId.value) || articleId.value <= 0) {
    message.error("文章 ID 不合法");
    void router.replace("/typing");
    return;
  }
  pageLoading.value = true;
  try {
    const article = await getTypingArticle(articleId.value);
    formModel.title = article.title;
    formModel.body = article.body;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载文章失败"));
    void router.replace("/typing");
  } finally {
    pageLoading.value = false;
  }
};

const handleSave = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: formModel.title.trim(),
      body: formModel.body.trim()
    };
    if (isEdit.value) {
      await updateTypingArticle(articleId.value, payload);
      message.success("已保存文章");
    } else {
      await createTypingArticle(payload);
      message.success("已创建文章");
    }
    await router.push("/typing");
  } catch (error) {
    message.error(apiErrorMessage(error, isEdit.value ? "保存文章失败" : "创建文章失败"));
  } finally {
    saving.value = false;
  }
};

watch(
  () => route.fullPath,
  () => {
    void loadArticle();
  }
);

onMounted(() => {
  void loadArticle();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card :title="isEdit ? '编辑练习文章' : '新建练习文章'">
        <n-spin :show="pageLoading">
          <n-form ref="formRef" :model="formModel" :rules="formRules" label-placement="top">
            <n-form-item label="标题" path="title">
              <n-input v-model:value="formModel.title" placeholder="例如：春晓" maxlength="80" show-count />
            </n-form-item>
            <n-form-item label="正文" path="body">
              <n-input
                v-model:value="formModel.body"
                type="textarea"
                placeholder="输入要练习的汉字或短文"
                :autosize="{ minRows: 8, maxRows: 18 }"
                show-count
              />
            </n-form-item>
            <n-space justify="end" class="form-actions">
              <n-button @click="router.push('/typing')">取消</n-button>
              <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
            </n-space>
          </n-form>
        </n-spin>
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

.form-actions {
  width: 100%;
}
</style>
