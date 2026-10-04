<script setup lang="ts">
import axios from "axios";
import { h, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NDataTable, NPopconfirm, NSpace, useMessage, type DataTableColumns } from "naive-ui";
import {
  createTypingPractice,
  deleteTypingArticle,
  listTypingArticles,
  type TypingArticle
} from "../../api/modules/typing";

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

function previewBody(body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= 24) return text || "—";
  return `${text.slice(0, 24)}…`;
}

const loading = ref(false);
const articles = ref<TypingArticle[]>([]);
const deletingId = ref<number | null>(null);
const startingId = ref<number | null>(null);

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page;
    void fetchArticles();
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    void fetchArticles();
  }
});

const columns: DataTableColumns<TypingArticle> = [
  {
    title: "标题",
    key: "title",
    ellipsis: { tooltip: true }
  },
  {
    title: "正文预览",
    key: "body",
    ellipsis: { tooltip: true },
    render: (row) => previewBody(row.body)
  },
  {
    title: "字数",
    key: "length",
    width: 80,
    render: (row) => String([...row.body].length)
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
    width: 280,
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
                type: "primary",
                loading: startingId.value === row.id,
                onClick: () => void handleStart(row)
              },
              { default: () => "开始练习" }
            ),
            h(
              NButton,
              {
                size: "small",
                onClick: () => router.push(`/typing/articles/${row.id}/edit`)
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

const fetchArticles = async () => {
  loading.value = true;
  try {
    const res = await listTypingArticles({
      page: pagination.page,
      limit: pagination.pageSize
    });
    articles.value = res.items;
    pagination.itemCount = res.meta.total_count;
    pagination.page = res.meta.current_page;
  } catch (error) {
    message.error(apiErrorMessage(error, "加载练习文章失败"));
  } finally {
    loading.value = false;
  }
};

const handleStart = async (article: TypingArticle) => {
  startingId.value = article.id;
  try {
    const practice = await createTypingPractice(article.id);
    await router.push(`/typing/practices/${practice.id}`);
  } catch (error) {
    message.error(apiErrorMessage(error, "创建练习失败"));
  } finally {
    startingId.value = null;
  }
};

const handleDelete = async (article: TypingArticle) => {
  deletingId.value = article.id;
  try {
    await deleteTypingArticle(article.id);
    message.success(`已删除「${article.title}」`);
    await fetchArticles();
  } catch (error) {
    message.error(apiErrorMessage(error, "删除文章失败"));
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  void fetchArticles();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="打字练习">
        <n-space vertical size="medium" class="content-stack">
          <n-space justify="space-between" wrap>
            <n-space>
              <n-button type="default" @click="router.push('/tools')">返回功能页</n-button>
              <n-button type="primary" @click="router.push('/typing/articles/create')">新建文章</n-button>
              <n-button type="default" @click="router.push('/typing/practices')">练习记录</n-button>
            </n-space>
          </n-space>
          <n-data-table
            remote
            :columns="columns"
            :data="articles"
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
