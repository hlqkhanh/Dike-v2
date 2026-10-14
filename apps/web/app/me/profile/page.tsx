"use client";

import { ApiError } from "@dike/api-client-ts";
import { Button, Card, Input } from "@dike/web-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  ChevronRight,
  Home,
  Save,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import { z } from "zod";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { authApi } from "../../../src/auth/api";
import { profileApi } from "../../../src/profile/api";
import {
  vietnamLocalities,
  vietnamProvinces,
} from "../../../src/profile/vietnam-provinces";
import { ErrorState, LoadingState } from "../../components/app-ui";

const schema = z.object({
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().max(300),
  dateOfBirth: z
    .string()
    .refine(
      (value) =>
        !value || new Date(`${value}T00:00:00`).getTime() <= Date.now(),
      "Ngày sinh không được ở tương lai",
    ),
  provinceCode: z.string(),
  localityCode: z.string(),
  facebookUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^https:\/\/(?:www\.)?facebook\.com\//i.test(value),
      "Hãy nhập liên kết Facebook hợp lệ",
    ),
});
type Values = z.infer<typeof schema>;

export default function MyProfilePage() {
  const queryClient = useQueryClient();
  const [fileId, setFileId] = useState<string>();
  const [toast, setToast] = useState<{
    tone: "success" | "error";
    message: string;
  }>();
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
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
    defaultValues: {
      displayName: "",
      bio: "",
      dateOfBirth: "",
      provinceCode: "",
      localityCode: "",
      facebookUrl: "",
    },
  });
  const bio = useWatch({ control: form.control, name: "bio" });
  const provinceCode = useWatch({
    control: form.control,
    name: "provinceCode",
  });
  const localities = vietnamLocalities[provinceCode] ?? [];
  useEffect(() => {
    if (profile.data) {
      form.reset({
        displayName: profile.data.displayName,
        bio: profile.data.bio,
        dateOfBirth: profile.data.dateOfBirth ?? "",
        provinceCode: profile.data.provinceCode ?? "",
        localityCode: profile.data.localityCode ?? "",
        facebookUrl: profile.data.facebookUrl ?? "",
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
      profileApi.updateProfile({
        ...values,
        dateOfBirth: values.dateOfBirth || undefined,
        provinceCode: values.provinceCode || undefined,
        localityCode: values.localityCode || undefined,
        localityName:
          localities.find(([code]) => code === values.localityCode)?.[1] ||
          undefined,
        facebookUrl: values.facebookUrl || undefined,
        expectedVersion: profile.data?.version ?? 0,
      }),
    onSuccess: (updated, submitted) => {
      const submittedLocalityName =
        vietnamLocalities[submitted.provinceCode]?.find(
          ([code]) => code === submitted.localityCode,
        )?.[1] ?? "";
      const saved = {
        ...updated,
        localityCode: updated.localityCode || submitted.localityCode,
        localityName: updated.localityName || submittedLocalityName,
      };
      queryClient.setQueryData(["profile", "me"], saved);
      form.reset({
        displayName: saved.displayName,
        bio: saved.bio,
        dateOfBirth: saved.dateOfBirth ?? "",
        provinceCode: saved.provinceCode ?? "",
        localityCode: saved.localityCode ?? "",
        facebookUrl: saved.facebookUrl ?? "",
      });
      setToast({ tone: "success", message: "Đã cập nhật hồ sơ thành công." });
    },
    onError: () =>
      setToast({
        tone: "error",
        message: "Không thể cập nhật hồ sơ. Vui lòng thử lại.",
      }),
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(undefined), 3_500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    <main className="profile-dashboard profile-edit-page">
      <section className="profile-dashboard-banner">
        <div className="profile-dashboard-avatar">
          {profile.data.avatarUrl ? (
            <Image
              unoptimized
              src={profile.data.avatarUrl}
              width={108}
              height={108}
              alt="Ảnh đại diện"
            />
          ) : (
            <span>{profile.data.displayName.slice(0, 1)}</span>
          )}
        </div>
        <div className="profile-dashboard-identity">
          <p>Hồ sơ Diké Share</p>
          <h1>{profile.data.displayName}</h1>
          <span>
            {profile.data.bio ||
              "Cùng cộng đồng tạo nên những hành trình xanh hơn."}
          </span>
          <Link className="profile-settings-button" href="/settings">
            <Settings size={16} /> Cài đặt
          </Link>
        </div>
      </section>
      <nav className="profile-edit-breadcrumb" aria-label="Đường dẫn">
        <Link href="/profile">
          <Home size={18} /> Cá nhân
        </Link>
        <ChevronRight size={16} />
        <span>Chỉnh sửa hồ sơ</span>
      </nav>
      <div className="profile-edit-layout">
        <aside className="profile-edit-sidebar">
          <Card className="profile-edit-avatar-card">
            <h2>
              <UserRound size={20} /> Ảnh đại diện
            </h2>
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
                <span>
                  <Camera size={18} /> Thay ảnh đại diện
                </span>
                <input
                  id="profile-avatar-upload"
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
            <label
              className="profile-edit-upload"
              htmlFor="profile-avatar-upload"
            >
              <Upload size={18} /> Chọn ảnh mới
            </label>
          </Card>
        </aside>
        <Card className="profile-edit-form-card" id="personal-info">
          <header className="profile-edit-form-heading">
            <UserRound size={24} />
            <div>
              <h2>Thông tin cá nhân</h2>
              <p>
                Cập nhật thông tin của bạn để người khác có thể biết về bạn.
              </p>
            </div>
          </header>
          <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
            <Input
              label="Tên hiển thị"
              error={form.formState.errors.displayName?.message}
              {...form.register("displayName")}
            />
            <label className="dike-field">
              <span>Giới thiệu</span>
              <textarea rows={3} maxLength={300} {...form.register("bio")} />
              <small>{bio.length}/300</small>
            </label>
            <div className="profile-form-grid">
              <Input
                label="Ngày sinh"
                type="date"
                error={form.formState.errors.dateOfBirth?.message}
                {...form.register("dateOfBirth")}
              />
              <label className="dike-field">
                <span>Tỉnh/Thành phố</span>
                <select
                  {...form.register("provinceCode", {
                    onChange: () => form.setValue("localityCode", ""),
                  })}
                >
                  <option value="">Chọn Tỉnh/Thành phố</option>
                  {vietnamProvinces.map(([code, name]) => (
                    <option value={code} key={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dike-field">
                <span>Quận/Huyện/Thành phố</span>
                <select
                  {...form.register("localityCode")}
                  disabled={!provinceCode}
                >
                  <option value="">
                    {provinceCode
                      ? "Chọn khu vực"
                      : "Chọn Tỉnh/Thành phố trước"}
                  </option>
                  {localities.map(([code, name]) => (
                    <option value={code} key={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dike-field profile-readonly-field">
                <span className="profile-field-label-row">
                  Số điện thoại đăng ký
                  <a href="/onboarding/phone?returnTo=/me/profile">Đổi số</a>
                </span>
                <input
                  value={
                    session.data?.user.phoneMasked ||
                    profile.data.contactPhone ||
                    "Chưa cập nhật"
                  }
                  readOnly
                />
                <small>
                  Số điện thoại được quản lý trong xác minh tài khoản.
                </small>
              </label>
              <label className="dike-field profile-readonly-field">
                <span>Email đăng ký</span>
                <input
                  value={
                    session.data?.user.email ||
                    profile.data.contactEmail ||
                    "Chưa cập nhật"
                  }
                  readOnly
                />
                <small>Email được lấy từ tài khoản đăng nhập.</small>
              </label>
            </div>
            <Input
              id="facebook-profile"
              label="Liên kết Facebook"
              type="url"
              placeholder="https://www.facebook.com/ten-cua-ban"
              error={form.formState.errors.facebookUrl?.message}
              {...form.register("facebookUrl")}
            />
            {save.error instanceof ApiError ? (
              <p className="auth-error" role="alert">
                {save.error.code === "PROFILE_VERSION_CONFLICT"
                  ? "Hồ sơ đã thay đổi ở nơi khác. Tải lại rồi thử lại."
                  : save.error.message}
              </p>
            ) : null}
            <div className="profile-edit-actions">
              <Link href="/profile">Hủy</Link>
              <Button type="submit" disabled={save.isPending}>
                <Save size={18} />
                {save.isPending ? "Đang lưu…" : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {toast ? (
        <div
          className={`profile-toast is-${toast.tone}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setToast(undefined)}
          >
            ×
          </button>
        </div>
      ) : null}
    </main>
  );
}
