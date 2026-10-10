"use client";

import { ApiError } from "@dike/api-client-ts";
import { Button, Card, Input } from "@dike/web-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Image from "next/image";
import { z } from "zod";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

const schema = z.object({
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().max(300),
});
type Values = z.infer<typeof schema>;

export default function MyProfilePage() {
  const queryClient = useQueryClient();
  const [fileId, setFileId] = useState<string>();
  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileApi.myProfile,
  });
  const file = useQuery({
    queryKey: ["files", fileId],
    queryFn: () => profileApi.file(fileId!),
    enabled: Boolean(fileId),
    refetchInterval: (query) =>
      query.state.data?.state === "PROCESSING" ? 2_000 : false,
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", bio: "" },
  });
  const bio = useWatch({ control: form.control, name: "bio" });
  useEffect(() => {
    if (profile.data) {
      form.reset({
        displayName: profile.data.displayName,
        bio: profile.data.bio,
      });
    }
  }, [form, profile.data]);
  useEffect(() => {
    if (file.data?.state === "READY") {
      void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    }
  }, [file.data?.state, queryClient]);
  const save = useMutation({
    mutationFn: (values: Values) =>
      profileApi.updateProfile(
        values.displayName,
        values.bio,
        profile.data?.version ?? 0,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      form.reset({ displayName: updated.displayName, bio: updated.bio });
    },
  });
  const upload = useMutation({
    mutationFn: async (selected: File) => {
      const grant = await profileApi.createUpload({
        purpose: "AVATAR",
        contentType: selected.type,
        sizeBytes: selected.size,
      });
      await profileApi.uploadToGrantedUrl(grant, selected);
      await profileApi.completeUpload(grant.fileId, crypto.randomUUID());
      return grant.fileId;
    },
    onSuccess: (id) => setFileId(id),
  });
  useAuthFailure(profile.error);
  useAuthFailure(save.error);
  useAuthFailure(upload.error);

  if (profile.isPending)
    return (
      <main className="settings-page">
        <LoadingState label="Đang tải hồ sơ" />
      </main>
    );
  if (profile.isError)
    return (
      <main className="settings-page">
        <ErrorState
          message={profile.error.message}
          onRetry={() => void profile.refetch()}
        />
      </main>
    );

  return (
    <main className="settings-page">
      <PageHeader
        eyebrow="Tài khoản"
        title="Hồ sơ của bạn"
        description="Tên và giới thiệu này được hiển thị theo quyền riêng tư bạn chọn."
      />
      <Card className="settings-card">
        <div className="avatar-row">
          {profile.data.avatarUrl ? (
            <Image
              unoptimized
              width={96}
              height={96}
              className="profile-avatar"
              src={profile.data.avatarUrl}
              alt="Ảnh đại diện hiện tại"
            />
          ) : (
            <div
              className="profile-avatar profile-avatar--empty"
              aria-label="Chưa có ảnh đại diện"
            >
              {profile.data.displayName.slice(0, 1)}
            </div>
          )}
          <label className="file-picker">
            <span>Thay ảnh đại diện</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={upload.isPending}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) upload.mutate(selected);
              }}
            />
          </label>
        </div>
        <p
          aria-live="polite"
          className={
            upload.isError || file.data?.state === "REJECTED"
              ? "auth-error"
              : "settings-help"
          }
        >
          {upload.isPending
            ? "Đang tải vào vùng kiểm tra…"
            : file.data?.state === "PROCESSING"
              ? "Đang kiểm tra và xử lý ảnh…"
              : file.data?.state === "READY"
                ? "Ảnh đã an toàn và hồ sơ đã được cập nhật."
                : file.data?.state === "REJECTED"
                  ? "Ảnh không vượt qua kiểm tra an toàn."
                  : "JPEG, PNG hoặc WebP; tối đa 5 MiB."}
        </p>
        <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Input
            label="Tên hiển thị"
            error={form.formState.errors.displayName?.message}
            {...form.register("displayName")}
          />
          <label className="dike-field">
            <span>Giới thiệu</span>
            <textarea rows={5} maxLength={300} {...form.register("bio")} />
            <small>{bio.length}/300</small>
          </label>
          {save.error instanceof ApiError ? (
            <p className="auth-error" role="alert">
              {save.error.code === "PROFILE_VERSION_CONFLICT"
                ? "Hồ sơ đã thay đổi ở nơi khác. Tải lại rồi thử lại."
                : save.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Đang lưu…" : "Lưu hồ sơ"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
