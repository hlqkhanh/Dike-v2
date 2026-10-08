import {
  ApiError,
  type IntentResponse,
  type RuleRequest,
  type ScheduleResponse,
} from "@dike/api-client-ts";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (init.method && !["GET", "HEAD"].includes(init.method)) {
    const csrf = document.cookie
      .split("; ")
      .find((value) => value.startsWith("XSRF-TOKEN="))
      ?.slice(11);
    if (csrf) headers.set("X-XSRF-TOKEN", decodeURIComponent(csrf));
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      body?.error?.code ?? "SCHEDULE_REQUEST_FAILED",
      body?.error?.message ?? "Không thể xử lý lịch trình.",
    );
  }
  return (await response.json()) as T;
}

export const scheduleApi = {
  list: () => request<ScheduleResponse[]>("/schedules"),
  get: (id: string) =>
    request<ScheduleResponse>(`/schedules/${encodeURIComponent(id)}`),
  create: (body: RuleRequest) =>
    request<ScheduleResponse>("/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  status: (id: string, action: "pause" | "resume", version: number) =>
    request<ScheduleResponse>(
      `/schedules/${encodeURIComponent(id)}/${action}`,
      {
        method: "POST",
        headers: { "If-Match": String(version) },
      },
    ),
  end: (id: string, version: number) =>
    request<ScheduleResponse>(`/schedules/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "If-Match": String(version) },
    }),
  intents: (from: string, to: string) =>
    request<IntentResponse[]>(
      `/travel-intents?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
  intent: (id: string) =>
    request<IntentResponse>(`/travel-intents/${encodeURIComponent(id)}`),
  matchIntent: (id: string) =>
    request<IntentResponse>(`/travel-intents/${encodeURIComponent(id)}/match`, {
      method: "POST",
    }),
};
