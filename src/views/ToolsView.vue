<script setup lang="ts">
import { useRouter } from "vue-router";
import { NButton, NCard, NSpace } from "naive-ui";

const router = useRouter();
</script>

<template>
  <main class="page">
    <n-card title="功能页" class="tools-card">
      <n-space vertical>
        <p>这里是功能入口页，你可以从这里进入具体业务模块。</p>
        <n-button type="primary" @click="router.push('/chores')">家务类型管理</n-button>
        <n-button type="default" @click="router.push('/chores/records')">家务记录管理</n-button>
        <n-button type="default" @click="router.push('/login')">返回登录</n-button>
      </n-space>
    </n-card>
  </main>
</template>

<style scoped>
.page {
  min-height: calc(100vh - 86px);
  display: grid;
  place-items: center;
}

.tools-card {
  width: min(100vw - 32px, 720px);
}
</style>
