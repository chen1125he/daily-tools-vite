import http from "../http";
import type { Recipe } from "./recipes";

export type MealType = "breakfast" | "lunch" | "dinner";

export interface Menu {
  id: number;
  user_id: number;
  menu_date: string;
  meal_type: MealType;
  recipes: Recipe[];
  created_at: string;
  updated_at: string;
}

export interface MenusListMeta {
  total_pages: number;
  current_page: number;
  total_count: number;
  next_page: number | null;
}

export interface MenusListResponse {
  items: Menu[];
  meta: MenusListMeta;
}

export interface ListMenusParams {
  page?: number;
  limit?: number;
  menu_date?: string;
  meal_type?: MealType | 0 | 1 | 2;
  from?: string;
  to?: string;
}

export interface MenuPayload {
  menu_date: string;
  meal_type: MealType | 0 | 1 | 2;
  recipe_ids?: number[];
}

export const listMenus = async (params?: ListMenusParams): Promise<MenusListResponse> => {
  return await http.get<MenusListResponse, MenusListResponse>("/v1/menus", { params });
};

export const getMenu = async (id: number): Promise<Menu> => {
  return await http.get<Menu, Menu>(`/v1/menus/${id}`);
};

export const createMenu = async (payload: MenuPayload): Promise<Menu> => {
  return await http.post<Menu, Menu>("/v1/menus", { menu: payload });
};

export const updateMenu = async (id: number, payload: Partial<MenuPayload>): Promise<Menu> => {
  return await http.patch<Menu, Menu>(`/v1/menus/${id}`, { menu: payload });
};

/** 删除成功时 body 仍为删除前对象快照 */
export const deleteMenu = async (id: number): Promise<Menu> => {
  return await http.delete<Menu, Menu>(`/v1/menus/${id}`);
};
