import { unwrapListData } from "../apiResponse";
import http from "../http";

export interface User {
  id: number;
  name: string;
  phone?: string;
  status?: string;
}

export const listUsers = async (): Promise<User[]> => {
  const raw = await http.get<unknown, unknown>("/v1/users");
  return unwrapListData<User>(raw);
};
