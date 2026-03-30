<script setup lang="ts">
import axios from "axios";
import { h, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NDataTable, NPopconfirm, NSpace, useMessage } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { deleteChore, listChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";

const router = useRouter();
const message = useMessage();

const loading = ref(false);
const chores = ref<Chore[]>([]);
const deletingId = ref<number | null>(null);

const columns: DataTableColumns<Chore> = [
  {
    title: "家务名",
    key: "name",
    ellipsis: { tooltip: true }
  },
  {
    title: "描述",
    key: "description",
    ellipsis: { tooltip: true }
  },
  {
    title: "默认分数",
    key: "default_points",
    width: 100,
    render: (row) => String(row.default_points)
  },
  {
    title: "状态",
    key: "active",
    width: 100,
    render: (row) => (row.active ? "启用" : "停用")
  },
  {
    title: "操作",
    key: "actions",
    width: 180,
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
                onClick: () => router.push(`/chores/${row.id}/edit`)
              },
              { default: () => "编辑" }
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => handleDelete(row)
              },
              {
                default: () => `确定删除「${row.name}」吗？`,
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

const fetchChores = async () => {
  loading.value = true;
  try {
    chores.value = await listChores();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "加载家务列表失败");
    } else {
      message.error("加载家务列表失败");
    }
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (chore: Chore) => {
  deletingId.value = chore.id;
  try {
    const result = await deleteChore(chore.id);
    message.success(result.message || `已删除「${chore.name}」`);
    await fetchChores();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "删除家务失败");
    } else {
      message.error("删除家务失败");
    }
  } finally {
    deletingId.value = null;
  }
};

onMounted(() => {
  fetchChores();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="家务类型列表" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-space justify="space-between">
            <n-space>
              <n-button type="primary" @click="router.push('/chores/create')">创建家务类型</n-button>
              <n-button type="default" @click="router.push('/chores/records')">家务记录管理</n-button>
            </n-space>
          </n-space>
          <n-data-table
            :columns="columns"
            :data="chores"
            :loading="loading"
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
</style>
