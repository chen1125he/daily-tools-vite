export interface AuthUser {
  id: number;
  phone: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  user: AuthUser;
}

const ACCESS_TOKEN_KEY = "auth.accessToken";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "auth.accessTokenExpiresAt";
const REFRESH_TOKEN_KEY = "auth.refreshToken";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "auth.refreshTokenExpiresAt";
const USER_KEY = "auth.user";

export const saveAuthSession = (session: AuthSession): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(
    ACCESS_TOKEN_EXPIRES_AT_KEY,
    String(session.accessTokenExpiresAt)
  );
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(
    REFRESH_TOKEN_EXPIRES_AT_KEY,
    String(session.refreshTokenExpiresAt)
  );
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const isAccessTokenValid = (): boolean => {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const expiresAtRaw = localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  if (!accessToken || !expiresAtRaw) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
};

export const isRefreshTokenValid = (): boolean => {
  const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
  const expiresAtRaw = localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  if (!rt || !expiresAtRaw) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
};

/** 仍在登录窗口内：access 未过期，或 refresh 未过期（可静默续期 access） */
export const hasActiveSession = (): boolean => {
  return isAccessTokenValid() || isRefreshTokenValid();
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  localStorage.removeItem(USER_KEY);
};
