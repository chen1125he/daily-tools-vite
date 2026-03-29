import axios from "axios";
import type { ApiResponse } from "./apiResponse";
import { unwrapApiEnvelope } from "./apiResponse";
import type { AuthUser } from "./session";
import {
  clearAuthSession,
  getRefreshToken,
  isAccessTokenValid,
  isRefreshTokenValid,
  saveAuthSession
} from "./session";

interface RefreshResponseBody {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: AuthUser;
}

let refreshPromise: Promise<void> | null = null;

async function redirectToLogin(): Promise<void> {
  const { default: router } = await import("../router");
  await router.replace("/login");
}

async function goRefresh(): Promise<void> {
  const rt = getRefreshToken();
  if (!rt) {
    clearAuthSession();
    await redirectToLogin();
    throw new Error("No refresh token");
  }
  try {
    const res = await axios.post<ApiResponse<RefreshResponseBody>>(
      "/api/v1/auth/refresh",
      { refresh_token: rt },
      { timeout: 10000 }
    );
    const data = unwrapApiEnvelope<RefreshResponseBody>(res.data);
    const nowMs = Date.now();
    saveAuthSession({
      accessToken: data.access_token,
      accessTokenExpiresAt: nowMs + data.expires_in * 1000,
      refreshToken: data.refresh_token,
      refreshTokenExpiresAt: nowMs + data.refresh_expires_in * 1000,
      user: data.user
    });
  } catch {
    clearAuthSession();
    await redirectToLogin();
    throw new Error("Refresh failed");
  }
}

export async function ensureValidAccessToken(options?: { force?: boolean }): Promise<void> {
  if (!options?.force && isAccessTokenValid()) return;
  if (!isRefreshTokenValid()) return;
  if (!refreshPromise) {
    refreshPromise = goRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  await refreshPromise;
}
