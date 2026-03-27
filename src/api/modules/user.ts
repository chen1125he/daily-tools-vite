import http from "../http";

export interface User {
  id: number;
  name: string;
  phone?: string;
  status?: string;
}

export const listUsers = async (): Promise<User[]> => {
  return await http.get<User[], User[]>("/v1/users");
};
