export interface ApiResponse<T> {
  code: number;
  message?: string;
  data: T;
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
