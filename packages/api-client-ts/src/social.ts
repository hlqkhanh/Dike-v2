import {
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "./configuration";
import { ApiError } from "./auth";
import type {
  RelationPage,
  RelationView,
  RevisionView,
  PublicProfileResponse,
} from "./generated/schema";

export function createSocialApi(configuration: ApiClientConfiguration) {
  const config = createApiClientConfiguration(configuration);
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });
    if (body) headers.set("Content-Type", "application/json");
    if (key) headers.set("Idempotency-Key", key);
    const requestId = config.requestId?.();
    if (requestId) headers.set("X-Request-Id", requestId);
    if (method !== "GET" && typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.slice(11);
      if (token) headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
    }
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: config.credentials,
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        error?.error?.code ?? "SOCIAL_REQUEST_FAILED",
        error?.error?.message ?? "Không thể xử lý yêu cầu",
      );
    }
    return response.json() as Promise<T>;
  }
  const targetPath = (id: string) => encodeURIComponent(id);
  return {
    list: (
      kind: "friends" | "incoming" | "outgoing" | "blocks",
      cursor?: string,
    ) => {
      const base =
        kind === "blocks"
          ? "/blocks"
          : kind === "friends"
            ? "/friendships"
            : `/friendships/requests?direction=${kind}`;
      return request<RelationPage>(
        `${base}${cursor ? `${base.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
    },
    relation: (target: string) =>
      request<RelationView>(`/friendships/users/${targetPath(target)}`),
    revision: () => request<RevisionView>("/social/revision"),
    search: (query: string) =>
      request<{ items: PublicProfileResponse[]; nextCursor?: string }>(
        `/users?query=${encodeURIComponent(query)}`,
      ),
    act: (
      action: string,
      target: string,
      requestId: string | null | undefined,
      key: string,
    ) => {
      if (action === "SEND")
        return request<RelationView>(
          "/friendships/requests",
          "POST",
          { targetUserId: target },
          key,
        );
      if (action === "BLOCK" || action === "UNBLOCK")
        return request<RelationView>(
          `/blocks/${targetPath(target)}`,
          action === "BLOCK" ? "PUT" : "DELETE",
          undefined,
          key,
        );
      if (action === "REMOVE")
        return request<RelationView>(
          `/friendships/${targetPath(target)}`,
          "DELETE",
          undefined,
          key,
        );
      if (!["ACCEPT", "DECLINE", "CANCEL"].includes(action) || !requestId)
        throw new Error("Thao tác không hợp lệ");
      return request<RelationView>(
        `/friendships/requests/${targetPath(requestId)}/${action.toLowerCase()}`,
        "POST",
        undefined,
        key,
      );
    },
  };
}
