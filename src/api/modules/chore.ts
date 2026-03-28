import axios from "axios";
import http from "../http";

export interface Chore {
  id: number;
  name: string;
  description: string;
  search_keywords?: string;
  default_points: number;
  active: boolean;
  message?: string;
}

export interface ChorePayload {
  name: string;
  description: string;
  search_keywords: string;
  default_points: number;
  active: boolean;
}

export const listChores = async (): Promise<Chore[]> => {
  return await http.get<Chore[], Chore[]>("/v1/chores");
};

export const listActiveChores = async (): Promise<Chore[]> => {
  return await http.get<Chore[], Chore[]>("/v1/chores?active=true");
};

export const getChore = async (id: number): Promise<Chore> => {
  return await http.get<Chore, Chore>(`/v1/chores/${id}`);
};

export const createChore = async (payload: ChorePayload): Promise<Chore> => {
  return await http.post<Chore, Chore>("/v1/chores", payload);
};

export const updateChore = async (id: number, payload: ChorePayload): Promise<Chore> => {
  try {
    return await http.patch<Chore, Chore>(`/v1/chores/${id}`, payload);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 405) {
      return await http.put<Chore, Chore>(`/v1/chores/${id}`, payload);
    }
    throw error;
  }
};

export const deleteChore = async (id: number): Promise<{ message?: string }> => {
  return await http.delete<{ message?: string }, { message?: string }>(`/v1/chores/${id}`);
};
