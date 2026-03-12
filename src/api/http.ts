import axios from "axios";
import { getAccessToken } from "./session";

export interface ApiResponse<T> {
  code: number;
  message?: string;
  data: T;
}

const http = axios.create({
  baseURL: "/api",
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

http.interceptors.response.use((response) => {
  const payload = response.data as ApiResponse<unknown>;
  const { data, message } = payload;
  if (
    message !== undefined &&
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    !("message" in data)
  ) {
    return { ...data, message } as unknown as typeof response;
  }
  return data as unknown as typeof response;
});

export default http;
