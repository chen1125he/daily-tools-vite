<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NButton,
  NConfigProvider,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NMessageProvider,
  NSpace
} from "naive-ui";

const route = useRoute();
const router = useRouter();
const isLoginPage = computed(() => route.path === "/login");

const go = (path: string) => {
  if (route.path === path) return;
  router.push(path);
};
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <n-layout class="layout">
        <n-layout-header bordered class="header">
          <n-space>
            <n-button :type="isLoginPage ? 'primary' : 'default'" @click="go('/login')">
              登录
            </n-button>
            <n-button :type="!isLoginPage ? 'primary' : 'default'" @click="go('/tools')">
              功能页
            </n-button>
          </n-space>
        </n-layout-header>
        <n-layout-content class="content">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
}

.content {
  padding: 20px;
}
</style>
