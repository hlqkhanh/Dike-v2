"use client";
import type { Operations } from "@dike/api-client-ts";
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
  return base + "/auth/google";
}
export async function authRequest<K extends keyof Operations>(
  operation: K,
  method: Operations[K]["method"],
  path: string,
  body?: Operations[K]["body"],
): Promise<Operations[K]["response"]> {
  void operation;
  const mutation = method !== "GET";
  if (mutation && !csrf) {
    const response = await fetch(base + "/auth/csrf", {
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
  const response = await fetch(base + path, {
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
    if (response.status === 401) clearAuth();
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
    refreshPending = authRequest("refreshSession", "POST", "/auth/refresh")
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
