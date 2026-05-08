import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ensureValidAccessToken } from "./authRefresh";
import { unwrapApiEnvelope } from "./apiResponse";
import { clearAuthSession, getAccessToken, isAccessTokenValid, isRefreshTokenValid } from "./session";

export type { ApiResponse } from "./apiResponse";

/** 普通接口默认超时（毫秒）。耗时任务请在单次请求里传入更大的 `timeout`。 */
const http = axios.create({
  baseURL: "/api",
  timeout: 10_000
});

function isPublicAuthPath(config: InternalAxiosRequestConfig): boolean {
  const u = config.url || "";
  return u.includes("/v1/auth/sign_in");
}

http.interceptors.request.use(async (config) => {
  if (isPublicAuthPath(config)) {
    return config;
  }
  await ensureValidAccessToken();
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    return unwrapApiEnvelope(response.data) as unknown as typeof response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (status !== 401 || !originalRequest || originalRequest._retry || isPublicAuthPath(originalRequest)) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;
    if (!isRefreshTokenValid()) {
      clearAuthSession();
      const { default: router } = await import("../router");
      await router.replace("/login");
      return Promise.reject(error);
    }
    try {
      await ensureValidAccessToken({ force: true });
      if (!isAccessTokenValid()) {
        clearAuthSession();
        const { default: router } = await import("../router");
        await router.replace("/login");
        return Promise.reject(error);
      }
      return http(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  }
);

export default http;
