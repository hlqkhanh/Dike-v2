"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { journeyApi } from "../../../src/journey/api";
import { profileApi } from "../../../src/profile/api";
import { ProfileSocialActions } from "../../../src/social/actions";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const [messageError, setMessageError] = useState("");
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => profileApi.userProfile(userId),
    retry: false,
  });
  const message = useMutation({
    mutationFn: () => journeyApi.direct(userId),
    onMutate: () => setMessageError(""),
    onSuccess: (conversation) =>
      router.push(`/inbox/${encodeURIComponent(conversation.id)}`),
    onError: (error) => setMessageError(error.message),
  });
  return (
    <main className="settings-page public-profile-page">
      <PageHeader
        backHref="/friends"
        backLabel="Bạn bè"
        eyebrow="Hồ sơ cộng đồng"
        title={profile.data?.displayName ?? "Hồ sơ thành viên"}
        description="Thông tin công khai giúp bạn lựa chọn người đồng hành phù hợp."
      />
      {profile.isPending ? (
        <LoadingState label="Đang tải hồ sơ" />
      ) : profile.isError ? (
        <ErrorState
          title="Không tìm thấy hồ sơ"
          message="Hồ sơ không tồn tại hoặc chủ tài khoản không chia sẻ thông tin này."
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <section className="settings-card public-profile-card">
          {profile.data.avatarUrl ? (
            <Image
              unoptimized
              width={128}
              height={128}
              className="profile-avatar profile-avatar--large"
              src={profile.data.avatarUrl}
              alt={`Ảnh đại diện của ${profile.data.displayName}`}
            />
          ) : (
            <span className="profile-avatar profile-avatar--large profile-avatar--empty">
              <UserRound aria-hidden="true" size={42} />
            </span>
          )}
          <div className="public-profile-copy">
            <p className="eyebrow">
              {profile.data.verified ? (
                <>
                  <ShieldCheck aria-hidden="true" size={16} /> Thành viên đã xác
                  minh
                </>
              ) : (
                "Thành viên Diké"
              )}
            </p>
            <h2>{profile.data.displayName}</h2>
            <p className="settings-copy">
              {profile.data.bio || "Người dùng chưa thêm phần giới thiệu."}
            </p>
            <div className="public-profile-actions">
              <button
                className="app-button app-button--primary"
                type="button"
                disabled={message.isPending}
                onClick={() => message.mutate()}
              >
                <MessageCircle aria-hidden="true" size={17} />{" "}
                {message.isPending ? "Đang mở…" : "Nhắn tin"}
              </button>
              <ProfileSocialActions userId={userId} />
            </div>
            {messageError ? (
              <p className="auth-error" role="alert">
                {messageError}
              </p>
            ) : null}
          </div>
        </section>
      )}
    </main>
  );
}
