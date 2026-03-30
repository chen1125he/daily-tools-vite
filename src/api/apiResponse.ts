export interface ApiResponse<T> {
  code: number;
  message?: string;
  data: T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 简单列表：兼容 `data: T[]` 与 `data: { items: T[] }`（见 tmp/backend-api-envelope-handoff.md） */
export function unwrapListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (isPlainObject(payload) && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

export function unwrapApiEnvelope<T>(payload: unknown): T {
  const p = payload as ApiResponse<T>;
  const { data, message } = p;

  if (
    message !== undefined &&
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    !("message" in data)
  ) {
    return { ...data, message } as unknown as T;
  }
  return data as unknown as T;
}
