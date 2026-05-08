import http from "../http";

/** 食材（与后端 Ingredient 一致） */
export interface Ingredient {
  id: number;
  name: string;
  search_keywords?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngredientsListMeta {
  total_pages: number;
  current_page: number;
  total_count: number;
  next_page: number | null;
}

export interface IngredientsListResponse {
  items: Ingredient[];
  meta: IngredientsListMeta;
}

export interface ListIngredientsParams {
  page?: number;
  limit?: number;
}

export interface IngredientWritePayload {
  name: string;
  search_keywords?: string | null;
}

export const listIngredients = async (
  params?: ListIngredientsParams
): Promise<IngredientsListResponse> => {
  return await http.get<IngredientsListResponse, IngredientsListResponse>("/v1/ingredients", {
    params
  });
};

export const getIngredient = async (id: number): Promise<Ingredient> => {
  return await http.get<Ingredient, Ingredient>(`/v1/ingredients/${id}`);
};

export const createIngredient = async (payload: IngredientWritePayload): Promise<Ingredient> => {
  return await http.post<Ingredient, Ingredient>("/v1/ingredients", {
    ingredient: payload
  });
};

export const updateIngredient = async (
  id: number,
  payload: IngredientWritePayload
): Promise<Ingredient> => {
  return await http.patch<Ingredient, Ingredient>(`/v1/ingredients/${id}`, {
    ingredient: payload
  });
};

/** 删除成功时 body 仍为删除前对象快照 */
export const deleteIngredient = async (id: number): Promise<Ingredient> => {
  return await http.delete<Ingredient, Ingredient>(`/v1/ingredients/${id}`);
};
