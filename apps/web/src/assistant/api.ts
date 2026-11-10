import { ApiError } from "@dike/api-client-ts";

export async function assistantRequest<T>(
  path: string,
  method = "POST",
  body?: unknown,
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (body) headers.set("Content-Type", "application/json");
  const csrf = document.cookie
    .split("; ")
    .find((v) => v.startsWith("XSRF-TOKEN="))
    ?.slice(11);
  if (csrf) headers.set("X-XSRF-TOKEN", decodeURIComponent(csrf));
  const response = await fetch(`/api/v1/assistant/conversations${path}`, {
    method,
    headers,
    credentials: "include",
    cache: "no-store",
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      result?.error?.code ?? "ASSISTANT_ERROR",
      result?.error?.message ?? "Chưa kết nối được trợ lý. Hãy thử lại.",
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
