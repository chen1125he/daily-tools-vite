import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import LoginView from "../views/LoginView.vue";
import ToolsView from "../views/ToolsView.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/login"
  },
  {
    path: "/login",
    name: "login",
    component: LoginView
  },
  {
    path: "/tools",
    name: "tools",
    component: ToolsView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
