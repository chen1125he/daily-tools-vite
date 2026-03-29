export interface ApiResponse<T> {
  code: number;
  message?: string;
  data: T;
  /** 部分列表接口与 `data` 同级返回分页信息（unwrap 时会与 `data` 合并进返回值） */
  meta?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function unwrapApiEnvelope<T>(payload: unknown): T {
  const p = payload as ApiResponse<T> & { meta?: unknown };
  const { data, message, meta } = p;

  // 分页列表常见形态：{ code, data: Item[], meta: { total_pages, ... } }
  // 若只返回 data，会丢失与信封同级的 meta
  if (Array.isArray(data) && isPlainObject(meta)) {
    return { data, meta } as unknown as T;
  }

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
