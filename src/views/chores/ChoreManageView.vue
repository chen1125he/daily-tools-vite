<script setup lang="ts">
import axios from "axios";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace, useMessage } from "naive-ui";
import { deleteChore, listChores } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import ChoreListTable from "../../components/chore/ChoreListTable.vue";

const router = useRouter();
const message = useMessage();

const loading = ref(false);
const chores = ref<Chore[]>([]);
const deletingId = ref<number | null>(null);

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
          <chore-list-table
            :chores="chores"
            :loading="loading"
            :deleting-id="deletingId"
            @edit="(chore) => router.push(`/chores/${chore.id}/edit`)"
            @delete="handleDelete"
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
