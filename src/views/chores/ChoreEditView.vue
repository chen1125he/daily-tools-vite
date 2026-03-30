<script setup lang="ts">
import axios from "axios";
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NCard, NSpin, NSpace, useMessage } from "naive-ui";
import { getChore } from "../../api/modules/chore";
import type { Chore } from "../../api/modules/chore";
import ChoreEditForm from "../../components/chore/ChoreEditForm.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const chore = ref<Chore | null>(null);

const choreId = computed(() => Number(route.params.id));
const isInvalidId = computed(() => !Number.isInteger(choreId.value) || choreId.value <= 0);

const fetchChore = async () => {
  if (isInvalidId.value) {
    message.error("家务 ID 不合法");
    router.push("/chores");
    return;
  }

  loading.value = true;
  try {
    chore.value = await getChore(choreId.value);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      message.error(error.response?.data?.message || "加载家务详情失败");
    } else {
      message.error("加载家务详情失败");
    }
    router.push("/chores");
  } finally {
    loading.value = false;
  }
};

const handleUpdated = () => {
  router.push("/chores");
};

onMounted(() => {
  fetchChore();
});
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="编辑家务类型" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/chores/list')">返回列表</n-button>
          <n-spin v-if="loading" size="small" />
          <chore-edit-form v-else-if="chore" :chore="chore" @updated="handleUpdated" />
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
