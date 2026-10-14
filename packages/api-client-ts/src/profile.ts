import {
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "./configuration";
import { ApiError } from "./auth";
import type {
  ConsentReceiptResponse,
  ConsentSummaryResponse,
  CreateUpload as CreateUploadRequest,
  DeletionResponse,
  FileView,
  MyProfileResponse,
  PrivacyResponse,
  PublicProfileResponse,
  UploadIntent,
  UpdateProfile,
} from "./generated/schema";

export function createProfileApi(configuration: ApiClientConfiguration) {
  const config = createApiClientConfiguration(configuration);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const requestId = config.requestId?.();
    if (requestId) headers.set("X-Request-Id", requestId);
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method)) {
      const csrf = readCookie("XSRF-TOKEN");
      if (csrf) headers.set("X-XSRF-TOKEN", decodeURIComponent(csrf));
    }
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: config.credentials,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? "Không thể xử lý yêu cầu",
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    myProfile: () => request<MyProfileResponse>("/me/profile"),
    updateProfile: (body: UpdateProfile) =>
      request<MyProfileResponse>("/me/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    userProfile: (userId: string) =>
      request<PublicProfileResponse>(`/users/${encodeURIComponent(userId)}`),
    privacy: () => request<PrivacyResponse>("/me/privacy"),
    updatePrivacy: (
      profileVisibility: string,
      discoverableByName: boolean,
      allowMessageRequests: boolean,
      expectedVersion: number,
    ) =>
      request<PrivacyResponse>("/me/privacy", {
        method: "PATCH",
        body: JSON.stringify({
          profileVisibility,
          discoverableByName,
          allowMessageRequests,
          expectedVersion,
        }),
      }),
    consents: () => request<ConsentSummaryResponse>("/me/consents"),
    acceptConsent: (consentType: string, locale = "vi") =>
      request<ConsentReceiptResponse>("/me/consents", {
        method: "POST",
        body: JSON.stringify({
          consentType,
          decision: "ACCEPTED",
          locale,
        }),
      }),
    deletion: () =>
      request<DeletionResponse | undefined>("/me/deletion-request"),
    requestDeletion: (idempotencyKey: string) =>
      request<DeletionResponse>("/me/deletion-requests", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    createUpload: (body: CreateUploadRequest) =>
      request<UploadIntent>("/files/uploads", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    completeUpload: (fileId: string, idempotencyKey: string) =>
      request<FileView>(`/files/${encodeURIComponent(fileId)}/complete`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    file: (fileId: string) =>
      request<FileView>(`/files/${encodeURIComponent(fileId)}`),
    deleteFile: (fileId: string, idempotencyKey: string) =>
      request<void>(`/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    uploadToGrantedUrl: async (grant: UploadIntent, file: File) => {
      if (!grant.uploadUrl)
        throw new Error("Upload grant does not contain a URL");
      const response = await fetch(grant.uploadUrl, {
        method: "PUT",
        headers: grant.requiredHeaders as Record<string, string>,
        body: file,
      });
      if (!response.ok) throw new Error("Không thể tải file lên vùng cách ly");
    },
  };
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
