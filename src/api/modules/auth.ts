import http from "../http";
import type { AuthUser } from "../session";
import { clearAuthSession, getRefreshToken, saveAuthSession } from "../session";

export interface SignInPayload {
  phone: string;
  password: string;
}

export interface SignInResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  user: AuthUser;
  message?: string;
}

export const signIn = async (payload: SignInPayload): Promise<SignInResponse> => {
  const data = await http.post<SignInResponse, SignInResponse>("/v1/auth/sign_in", payload);
  const nowMs = Date.now();
  saveAuthSession({
    accessToken: data.access_token,
    accessTokenExpiresAt: nowMs + data.expires_in * 1000,
    refreshToken: data.refresh_token,
    refreshTokenExpiresAt: nowMs + data.refresh_expires_in * 1000,
    user: data.user
  });
  return data;
};

/** 有 refresh_token 时通知服务端注销；无则仅清本地 session */
export const signOut = async (): Promise<void> => {
  const rt = getRefreshToken();
  if (!rt) {
    clearAuthSession();
    return;
  }
  try {
    await http.delete("/v1/auth/sign_out", {
      data: { refresh_token: rt }
    });
  } catch {
    // 仍清除本地态，避免无法退出
  }
  clearAuthSession();
};
