import http from "../http";

export type RecipeIngredientRole = "main" | "side" | "condiment";

/** 嵌套在 recipe_ingredients[].ingredient */
export interface RecipeNestedIngredient {
  id: number;
  name: string;
  search_keywords?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  id: number;
  role: RecipeIngredientRole;
  role_label: string;
  amount: string | null;
  ingredient: RecipeNestedIngredient;
}

export interface Recipe {
  id: number;
  user_id: number;
  title: string;
  prep_description: string | null;
  cook_description: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  nutrition: string | null;
  source_text: string | null;
  recipe_ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
}

export interface RecipesListMeta {
  total_pages: number;
  current_page: number;
  total_count: number;
  next_page: number | null;
}

export interface RecipesListResponse {
  items: Recipe[];
  meta: RecipesListMeta;
}

export interface ListRecipesParams {
  page?: number;
  limit?: number;
}

/** Rails nested attributes；也可用键名 `recipe_ingredients` 提交 */
export interface RecipeIngredientAttribute {
  id?: number;
  ingredient_id?: number;
  role?: RecipeIngredientRole;
  amount?: string | null;
  _destroy?: boolean | "1";
}

export interface RecipePayload {
  title: string;
  prep_description?: string | null;
  cook_description?: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  nutrition?: string | null;
  source_text?: string | null;
  recipe_ingredients_attributes?: RecipeIngredientAttribute[];
}

export const listRecipes = async (params?: ListRecipesParams): Promise<RecipesListResponse> => {
  return await http.get<RecipesListResponse, RecipesListResponse>("/v1/recipes", { params });
};

export const getRecipe = async (id: number): Promise<Recipe> => {
  return await http.get<Recipe, Recipe>(`/v1/recipes/${id}`);
};

export const createRecipe = async (payload: RecipePayload): Promise<Recipe> => {
  return await http.post<Recipe, Recipe>("/v1/recipes", { recipe: payload });
};

/** 一键解析菜谱全文并创建食谱（服务端 AI）；成功返回新建 Recipe */
export interface ParseRecipeFromTextPayload {
  text: string;
}

/** AI 解析较慢，单独放宽超时，避免服务端已成功而前端 10s 默认超时先失败 */
const PARSE_RECIPE_FROM_TEXT_TIMEOUT_MS = 60_000;

export const parseRecipeFromText = async (payload: ParseRecipeFromTextPayload): Promise<Recipe> => {
  return await http.post<Recipe, Recipe>("/v1/recipes/parse_from_text", payload, {
    timeout: PARSE_RECIPE_FROM_TEXT_TIMEOUT_MS
  });
};

export const updateRecipe = async (id: number, payload: Partial<RecipePayload>): Promise<Recipe> => {
  return await http.patch<Recipe, Recipe>(`/v1/recipes/${id}`, { recipe: payload });
};

/** 删除成功时 body 仍为删除前对象快照 */
export const deleteRecipe = async (id: number): Promise<Recipe> => {
  return await http.delete<Recipe, Recipe>(`/v1/recipes/${id}`);
};
