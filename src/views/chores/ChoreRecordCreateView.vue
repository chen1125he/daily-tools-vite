<script setup lang="ts">
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace } from "naive-ui";
import ChoreRecordManualCreateForm from "../../components/chore/ChoreRecordManualCreateForm.vue";

const router = useRouter();

const handleCreated = () => {
  router.push("/chores/records/list");
};
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="手动创建家务记录" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/chores/records/list')">返回列表</n-button>
          <chore-record-manual-create-form @created="handleCreated" />
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
