"use client";
import { operationDefinitions, type Operations } from "@dike/api-client-ts";
import { publicConfiguration } from "../config/public";
const base = publicConfiguration().apiBaseUrl;
let csrf: string | undefined;
let refreshPending: Promise<unknown> | undefined;
export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function clearAuth() {
  csrf = undefined;
}
export function googleLoginUrl() {
  return operationUrl("startGoogleLogin");
}
function operationUrl(
  operation: keyof Operations,
  parameters: Record<string, string> = {},
) {
  const path = operationDefinitions[operation].path.replace(
    /\{([^}]+)\}/gu,
    (_, name: string) => {
      const value = parameters[name];
      if (!value) throw new Error(`Missing path parameter: ${name}`);
      return encodeURIComponent(value);
    },
  );
  if (!path.startsWith("/api/v1/")) throw new Error("Unsupported API path");
  return base + path.slice("/api/v1".length);
}
export async function authRequest<K extends keyof Operations>(
  operation: K,
  options: { body?: Operations[K]["body"]; path?: Record<string, string> } = {},
): Promise<Operations[K]["response"]> {
  const { method } = operationDefinitions[operation];
  const url = operationUrl(operation, options.path);
  const { body } = options;
  const mutation = method !== "GET";
  if (mutation && !csrf) {
    const response = await fetch(operationUrl("getCsrf"), {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 401) clearAuth();
      throw new AuthError(
        response.status,
        response.status === 401 ? "SESSION_REQUIRED" : "UNAVAILABLE",
      );
    }
    csrf = ((await response.json()) as { token: string }).token;
  }
  const response = await fetch(url, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(mutation && csrf ? { "X-CSRF-TOKEN": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const value = (await response.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    if (response.status === 401 || value.error?.code === "CSRF_INVALID")
      clearAuth();
    throw new AuthError(response.status, value.error?.code ?? "UNAVAILABLE");
  }
  if (response.status === 204) {
    clearAuth();
    return undefined as Operations[K]["response"];
  }
  return response.json() as Promise<Operations[K]["response"]>;
}
export function refreshSession() {
  if (!refreshPending)
    refreshPending = authRequest("refreshSession")
      .then((value) => {
        csrf = value.token;
        return value;
      })
      .finally(() => {
        refreshPending = undefined;
      });
  return refreshPending;
}
export function authMessage(error: unknown) {
  if (error instanceof AuthError) {
    if (error.status === 401)
      return "Phiên đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.code === "PHONE_INVALID" || error.code === "VALIDATION_ERROR")
      return "Nhập số di động Việt Nam hợp lệ.";
    if (error.status === 429)
      return "Đã đạt giới hạn yêu cầu. Chờ một phút rồi thử lại.";
    if (error.status === 403)
      return "Không thể xác nhận yêu cầu. Tải lại trang rồi thử lại.";
  }
  return "Dịch vụ chưa khả dụng. Vui lòng thử lại; thao tác chưa được xác nhận thành công.";
}
