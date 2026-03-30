<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import { signOut } from "./api/modules/auth";
import { hasActiveSession } from "./api/session";

const route = useRoute();
const router = useRouter();
const isLoginPage = computed(() => route.path === "/login");
const isToolsPage = computed(() => route.path === "/tools");
const isChoresPage = computed(() => route.path.startsWith("/chores/records"));
const isLoggedIn = ref(hasActiveSession());

const go = (path: string) => {
  if (route.path === path) return;
  console.log("go", path);
  router.push(path);
};

const handleLogout = async () => {
  await signOut();
  isLoggedIn.value = false;
  if (!isLoginPage.value) {
    await router.replace("/login");
  }
};

watch(
  () => route.fullPath,
  () => {
    isLoggedIn.value = hasActiveSession();
  }
);
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <n-layout class="layout">
        <n-layout-header bordered class="header" v-if="!isLoginPage">
          <n-space>
            <n-button :type="isToolsPage ? 'primary' : 'default'" @click="go('/tools')">
              功能页
            </n-button>
            <n-button :type="isChoresPage ? 'primary' : 'default'" @click="go('/chores/records')">
              家务管理
            </n-button>
            <n-button v-if="isLoggedIn" type="error" ghost @click="handleLogout">退出登录</n-button>
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
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
