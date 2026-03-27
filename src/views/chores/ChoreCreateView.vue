<script setup lang="ts">
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace } from "naive-ui";
import ChoreCreateForm from "../../components/chore/ChoreCreateForm.vue";

const router = useRouter();

const handleCreated = () => {
  router.push("/chores");
};
</script>

<template>
  <main class="page">
    <div class="page-inner">
      <n-card title="创建家务类型" style="width: 100%">
        <n-space vertical size="medium" class="content-stack">
          <n-button quaternary @click="router.push('/chores')">返回列表</n-button>
          <chore-create-form @created="handleCreated" />
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
