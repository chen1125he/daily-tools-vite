import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import LoginView from "../views/LoginView.vue";
import ToolsView from "../views/ToolsView.vue";
import ChoreManageView from "../views/chores/ChoreManageView.vue";
import ChoreCreateView from "../views/chores/ChoreCreateView.vue";
import ChoreEditView from "../views/chores/ChoreEditView.vue";
import ChoreRecordAiCreateView from "../views/chores/ChoreRecordAiCreateView.vue";
import ChoreRecordListView from "../views/chores/ChoreRecordListView.vue";
import ChoreRecordCreateView from "../views/chores/ChoreRecordCreateView.vue";
import RecipeManageView from "../views/recipes/RecipeManageView.vue";
import RecipeFormView from "../views/recipes/RecipeFormView.vue";
import RecipeParseFromTextView from "../views/recipes/RecipeParseFromTextView.vue";
import IngredientListView from "../views/recipes/IngredientListView.vue";
import { hasActiveSession } from "../api/session";

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
  },
  {
    path: "/chores/list",
    name: "chores-list",
    component: ChoreManageView
  },
  {
    path: "/chores/create",
    name: "chores-create",
    component: ChoreCreateView
  },
  {
    path: "/chores/:id/edit",
    name: "chores-edit",
    component: ChoreEditView
  },
  {
    path: "/chores/records/list",
    name: "chores-records-list",
    component: ChoreRecordListView
  },
  {
    path: "/chores/records/create",
    name: "chores-records-create",
    component: ChoreRecordCreateView
  },
  {
    path: "/chores/records",
    name: "chores-records",
    component: ChoreRecordAiCreateView
  },
  {
    path: "/recipes",
    name: "recipes",
    component: RecipeManageView
  },
  {
    path: "/recipes/create",
    name: "recipes-create",
    component: RecipeFormView
  },
  {
    path: "/recipes/parse",
    name: "recipes-parse",
    component: RecipeParseFromTextView
  },
  {
    path: "/recipes/:id/edit",
    name: "recipes-edit",
    component: RecipeFormView
  },
  {
    path: "/recipes/ingredients",
    name: "recipes-ingredients",
    component: IngredientListView
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const PROTECTED_PATH_PREFIXES = ["/tools", "/chores", "/recipes"];

router.beforeEach((to) => {
  const isLoggedIn = hasActiveSession();
  const isLoginPage = to.path === "/login";
  const needAuth = PROTECTED_PATH_PREFIXES.some((prefix) => to.path.startsWith(prefix));

  if (needAuth && !isLoggedIn) {
    return { path: "/login" };
  }

  if (isLoginPage && isLoggedIn) {
    return { path: "/tools" };
  }

  return true;
});

export default router;
