"use client";

import { Card } from "@dike/web-ui";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => profileApi.userProfile(userId),
    retry: false,
  });
  useAuthFailure(profile.error);

  return (
    <main className="settings-page">
      {profile.isPending ? (
        <p className="settings-state">Đang tải hồ sơ…</p>
      ) : profile.isError ? (
        <Card className="settings-card">
          <h1>Không tìm thấy hồ sơ</h1>
          <p>
            Hồ sơ không tồn tại hoặc chủ tài khoản không chia sẻ thông tin này.
          </p>
        </Card>
      ) : (
        <Card className="public-profile-card">
          {profile.data.avatarUrl ? (
            <img
              className="profile-avatar profile-avatar--large"
              src={profile.data.avatarUrl}
              alt={`Ảnh đại diện của ${profile.data.displayName}`}
            />
          ) : null}
          <div>
            <p className="eyebrow">
              Thành viên {profile.data.verified ? "đã xác minh" : ""}
            </p>
            <h1>{profile.data.displayName}</h1>
            <p className="settings-copy">
              {profile.data.bio || "Người dùng chưa thêm phần giới thiệu."}
            </p>
          </div>
        </Card>
      )}
    </main>
  );
}
