"use client";

import { ApiError } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  FileCheck2,
  Laptop,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { authApi } from "../../src/auth/api";
import { useAuthFailure } from "../../src/auth/use-auth-failure";
import { expireSession } from "../../src/auth/session-expiry";
import { profileApi } from "../../src/profile/api";
import { ErrorState, LoadingState, PageHeader } from "../components/app-ui";
import { MemberAvatar } from "../components/member-avatar";

const consentLabels: Record<string, string> = {
  TERMS: "Điều khoản sử dụng",
  PRIVACY_NOTICE: "Thông báo quyền riêng tư",
  AGE_18_ATTESTATION: "Xác nhận đủ 18 tuổi",
};

export default function SettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [privacyDraft, setPrivacyDraft] = useState<{
    profileVisibility: string;
    discoverableByName: boolean;
    allowMessageRequests: boolean;
    version: number;
  }>();
  const [deletionConfirmed, setDeletionConfirmed] = useState(false);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileApi.myProfile,
  });
  const privacy = useQuery({
    queryKey: ["privacy", "me"],
    queryFn: profileApi.privacy,
  });
  const consents = useQuery({
    queryKey: ["consents", "me"],
    queryFn: profileApi.consents,
  });
  const sessions = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: authApi.sessions,
  });
  const deletion = useQuery({
    queryKey: ["account", "deletion"],
    queryFn: profileApi.deletion,
    retry: false,
  });
  const currentPrivacy = privacyDraft ?? privacy.data;

  const savePrivacy = useMutation({
    mutationFn: () =>
      profileApi.updatePrivacy(
        currentPrivacy?.profileVisibility ?? "MEMBERS",
        currentPrivacy?.discoverableByName ?? true,
        currentPrivacy?.allowMessageRequests ?? true,
        currentPrivacy?.version ?? 0,
      ),
    onSuccess: (value) => {
      client.setQueryData(["privacy", "me"], value);
      setPrivacyDraft(undefined);
    },
  });
  const acceptConsent = useMutation({
    mutationFn: (type: string) => profileApi.acceptConsent(type),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["consents", "me"] }),
        client.invalidateQueries({ queryKey: ["auth", "session"] }),
      ]);
    },
  });
  const revoke = useMutation({
    mutationFn: authApi.revoke,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["auth", "sessions"] }),
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      expireSession(client);
      router.replace("/");
    },
  });
  const requestDeletion = useMutation({
    mutationFn: () => profileApi.requestDeletion(crypto.randomUUID()),
    onSuccess: () => {
      expireSession(client);
      router.replace("/");
    },
  });
  useAuthFailure(
    session.error ??
      profile.error ??
      privacy.error ??
      consents.error ??
      sessions.error ??
      savePrivacy.error ??
      acceptConsent.error ??
      revoke.error ??
      logoutAll.error,
  );

  const user = session.data?.user;
  const simulated = user?.accessMode === "SIMULATED";
  const verificationProgress =
    simulated || user?.phoneStatus === "VERIFIED" ? 3 : 2;

  return (
    <main className="settings-page settings-overview">
      <PageHeader
        eyebrow="Trung tâm tài khoản"
        title="Cài đặt"
        description="Quản lý toàn bộ thông tin, quyền riêng tư và bảo mật tài khoản trên cùng một trang."
      />
      <nav className="settings-section-nav" aria-label="Các mục cài đặt">
        <a href="#account">Tài khoản</a>
        <a href="#privacy">Quyền riêng tư</a>
        <a href="#verification">Xác minh</a>
        <a href="#consents">Tài liệu</a>
        <a href="#security">Bảo mật</a>
      </nav>

      <section className="settings-zone" id="account">
        <ZoneHeading
          icon={UserRound}
          title="Tài khoản và hồ sơ"
          description="Thông tin đang được hiển thị với cộng đồng Diké."
        />
        {session.isPending || profile.isPending ? (
          <LoadingState label="Đang tải thông tin tài khoản" />
        ) : session.isError || profile.isError || !user ? (
          <ErrorState
            message="Không thể tải thông tin tài khoản."
            onRetry={() => {
              void session.refetch();
              void profile.refetch();
            }}
          />
        ) : (
          <div className="settings-account-summary">
            <MemberAvatar
              name={profile.data?.displayName || user.displayName}
              avatarUrl={profile.data?.avatarUrl || user.avatarUrl}
              className="settings-account-avatar"
              size={64}
            />
            <div>
              <strong>{profile.data?.displayName || user.displayName}</strong>
              <span>
                <Mail aria-hidden="true" size={15} />
                {user.email || profile.data?.contactEmail || "Chưa có email"}
              </span>
              <span>
                <Phone aria-hidden="true" size={15} />
                {user.phoneMasked ||
                  profile.data?.contactPhone ||
                  "Chưa thêm số điện thoại"}
              </span>
            </div>
            <Link className="settings-outline-action" href="/me/profile">
              Chỉnh sửa hồ sơ <ChevronRight size={17} />
            </Link>
          </div>
        )}
      </section>

      <section className="settings-zone" id="privacy">
        <ZoneHeading
          icon={SlidersHorizontal}
          title="Quyền riêng tư"
          description="Kiểm soát khả năng được tìm thấy, xem hồ sơ và liên hệ."
        />
        {privacy.isPending ? (
          <LoadingState label="Đang tải quyền riêng tư" />
        ) : privacy.isError || !currentPrivacy ? (
          <ErrorState
            message="Không thể tải quyền riêng tư."
            onRetry={() => void privacy.refetch()}
          />
        ) : (
          <form
            className="settings-zone-form"
            onSubmit={(event) => {
              event.preventDefault();
              savePrivacy.mutate();
            }}
          >
            <label className="settings-select-row">
              <span>
                <strong>Ai có thể xem hồ sơ cơ bản</strong>
                <small>Áp dụng cho thông tin trên trang hồ sơ của bạn.</small>
              </span>
              <select
                value={currentPrivacy.profileVisibility}
                onChange={(event) =>
                  setPrivacyDraft({
                    ...currentPrivacy,
                    profileVisibility: event.target.value,
                  })
                }
              >
                <option value="MEMBERS">Thành viên đã đăng nhập</option>
                <option value="PRIVATE">Chỉ mình tôi</option>
              </select>
            </label>
            <SettingsToggle
              title="Cho phép tìm bằng tên"
              description="Email và số điện thoại không được dùng để tìm kiếm."
              checked={currentPrivacy.discoverableByName}
              onChange={(checked) =>
                setPrivacyDraft({
                  ...currentPrivacy,
                  discoverableByName: checked,
                })
              }
            />
            <SettingsToggle
              title="Cho phép yêu cầu nhắn tin"
              description="Thành viên phù hợp có thể gửi lời mời trò chuyện."
              checked={currentPrivacy.allowMessageRequests}
              onChange={(checked) =>
                setPrivacyDraft({
                  ...currentPrivacy,
                  allowMessageRequests: checked,
                })
              }
            />
            <div className="settings-save-row">
              {savePrivacy.isError ? (
                <p role="alert">Không thể lưu thay đổi. Vui lòng tải lại.</p>
              ) : savePrivacy.isSuccess ? (
                <p role="status">
                  <Check size={16} /> Đã lưu thay đổi
                </p>
              ) : null}
              <button
                className="settings-primary-action"
                type="submit"
                disabled={savePrivacy.isPending || !privacyDraft}
              >
                {savePrivacy.isPending ? "Đang lưu…" : "Lưu quyền riêng tư"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="settings-zone" id="verification">
        <ZoneHeading
          icon={ShieldCheck}
          title="Xác minh và quyền truy cập"
          description="Theo dõi mức độ hoàn thiện và quyền hiện tại của tài khoản."
        />
        {session.isPending ? (
          <LoadingState label="Đang tải trạng thái xác minh" />
        ) : user ? (
          <>
            <div className="settings-verification-progress">
              <div>
                <strong>{verificationProgress}/5 bước đã hoàn thành</strong>
                <span>
                  {simulated
                    ? "Quyền thử nghiệm đang được bật."
                    : "Hoàn thiện xác minh để mở thêm quyền."}
                </span>
              </div>
              <progress max="5" value={verificationProgress} />
            </div>
            <div className="settings-status-grid">
              <StatusItem title="Google" value="Đã liên kết" tone="success" />
              <StatusItem
                title="Số điện thoại"
                value={
                  user.phoneStatus === "VERIFIED"
                    ? "Đã xác minh"
                    : "Chưa xác minh"
                }
                tone={user.phoneStatus === "VERIFIED" ? "success" : "warning"}
              />
              <StatusItem title="eKYC" value="Tạm hoãn" tone="neutral" />
              <StatusItem
                title="Quyền tài xế"
                value={
                  simulated
                    ? "Quyền thử nghiệm"
                    : user.driverApprovalEvidence === "REAL"
                      ? "Đã duyệt"
                      : "Chưa được duyệt"
                }
                tone={simulated ? "warning" : "neutral"}
              />
            </div>
            <Link className="settings-inline-link" href="/verification">
              Xem chi tiết xác minh <ChevronRight size={16} />
            </Link>
          </>
        ) : null}
      </section>

      <section className="settings-zone" id="consents">
        <ZoneHeading
          icon={FileCheck2}
          title="Đồng ý và tài liệu"
          description="Kiểm tra phiên bản điều khoản và các chấp thuận bắt buộc."
        />
        {consents.isPending ? (
          <LoadingState label="Đang tải tài liệu" />
        ) : consents.isError ? (
          <ErrorState
            message="Không thể tải tài liệu đồng ý."
            onRetry={() => void consents.refetch()}
          />
        ) : (
          <div className="settings-consent-list">
            {consents.data.requirements.map((requirement) => (
              <article key={`${requirement.type}-${requirement.version}`}>
                <span className={requirement.accepted ? "is-accepted" : ""}>
                  <FileCheck2 size={19} />
                </span>
                <div>
                  <strong>
                    {consentLabels[requirement.type] ?? requirement.type}
                  </strong>
                  <small>Phiên bản {requirement.version}</small>
                </div>
                {requirement.documentUrl ? (
                  <a
                    href={requirement.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Đọc tài liệu
                  </a>
                ) : null}
                {requirement.accepted ? (
                  <b className="is-accepted">Đã ghi nhận</b>
                ) : (
                  <button
                    type="button"
                    disabled={acceptConsent.isPending}
                    onClick={() => acceptConsent.mutate(requirement.type)}
                  >
                    Tôi đồng ý
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="settings-zone" id="security">
        <ZoneHeading
          icon={LockKeyhole}
          title="Thiết bị đăng nhập"
          description="Kiểm tra và thu hồi các phiên bạn không nhận ra."
          action={
            <button
              className="settings-outline-action"
              type="button"
              disabled={logoutAll.isPending}
              onClick={() => logoutAll.mutate()}
            >
              <LogOut size={16} /> Đăng xuất tất cả
            </button>
          }
        />
        {sessions.isPending ? (
          <LoadingState label="Đang tải thiết bị" />
        ) : sessions.isError ? (
          <ErrorState
            message="Không thể tải các thiết bị đăng nhập."
            onRetry={() => void sessions.refetch()}
          />
        ) : (
          <div className="settings-device-list">
            {sessions.data.sessions.map((activeSession) => (
              <article key={activeSession.id}>
                <span>
                  <Laptop size={20} />
                </span>
                <div>
                  <strong>{activeSession.deviceLabel}</strong>
                  <small>
                    Hoạt động gần nhất:{" "}
                    {new Date(activeSession.lastSeenAt).toLocaleString("vi-VN")}
                  </small>
                </div>
                {activeSession.current ? (
                  <b>Thiết bị này</b>
                ) : (
                  <button
                    type="button"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(activeSession.id)}
                  >
                    Đăng xuất
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="settings-zone settings-danger-zone" id="danger">
        <ZoneHeading
          icon={Trash2}
          title="Xóa tài khoản"
          description="Yêu cầu xóa hồ sơ và dữ liệu do tài khoản sở hữu."
        />
        {deletion.isPending ? (
          <LoadingState label="Đang kiểm tra yêu cầu xóa" />
        ) : deletion.data ? (
          <p className="settings-deletion-status">
            Yêu cầu đang được xử lý, dự kiến bắt đầu sau{" "}
            <time>
              {new Date(deletion.data.executeAfter).toLocaleString("vi-VN")}
            </time>
            .
          </p>
        ) : (
          <div className="settings-danger-content">
            <SettingsToggle
              title="Tôi hiểu thao tác này sẽ đăng xuất tài khoản ngay lập tức"
              description="Yêu cầu chưa thể hoàn tác trong phiên bản hiện tại."
              checked={deletionConfirmed}
              onChange={setDeletionConfirmed}
            />
            {requestDeletion.error instanceof ApiError ? (
              <p className="auth-error" role="alert">
                {requestDeletion.error.code ===
                "ACCOUNT_DELETION_REAUTH_REQUIRED"
                  ? "Bạn cần đăng nhập lại bằng Google trước khi gửi yêu cầu."
                  : requestDeletion.error.message}
              </p>
            ) : null}
            <button
              className="settings-delete-action"
              type="button"
              disabled={!deletionConfirmed || requestDeletion.isPending}
              onClick={() => requestDeletion.mutate()}
            >
              <Trash2 size={17} />
              {requestDeletion.isPending
                ? "Đang gửi yêu cầu…"
                : "Yêu cầu xóa tài khoản"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function ZoneHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="settings-zone-heading">
      <span>
        <Icon size={21} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function SettingsToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-switch-row">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}

function StatusItem({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <article>
      <span>{title}</span>
      <strong className={`is-${tone}`}>{value}</strong>
    </article>
  );
}
