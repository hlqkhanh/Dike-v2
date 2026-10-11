"use client";

import { Card } from "@dike/web-ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { authApi } from "../../src/auth/api";
import { ErrorState, LoadingState, PageHeader } from "../components/app-ui";

export default function VerificationPage() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });

  if (session.isPending) {
    return (
      <main className="settings-page">
        <LoadingState label="Đang tải trạng thái tài khoản" />
      </main>
    );
  }
  if (session.isError || !session.data) {
    return (
      <main className="settings-page">
        <ErrorState
          message="Không thể tải trạng thái tài khoản."
          onRetry={() => void session.refetch()}
        />
      </main>
    );
  }

  const user = session.data.user;
  const simulated = user.accessMode === "SIMULATED";
  return (
    <main className="settings-page">
      <PageHeader
        eyebrow="Minh bạch trạng thái"
        title="Xác minh và quyền truy cập"
        description="Kiểm tra mức xác minh và các quyền hiện đang được cấp cho tài khoản."
      />
      <p className="settings-copy">
        Trạng thái tài khoản của <strong>{user.displayName}</strong>
      </p>
      <section className="verification-progress" aria-label="Tiến độ xác minh">
        <div>
          <span>Tiến độ thiết lập</span>
          <strong>
            {simulated
              ? "3/5 bước"
              : user.phoneStatus === "VERIFIED"
                ? "3/5 bước"
                : "2/5 bước"}
          </strong>
        </div>
        <progress
          max="5"
          value={simulated || user.phoneStatus === "VERIFIED" ? 3 : 2}
        >
          3 trên 5
        </progress>
        <p>
          eKYC và duyệt phương tiện thật đang được hoãn; trạng thái thử nghiệm
          không thay thế xác minh production.
        </p>
      </section>
      {simulated ? (
        <p className="simulation-notice" role="status">
          Bạn đang dùng quyền thử nghiệm trên môi trường phát triển. Quyền này
          không phải xác minh production.
        </p>
      ) : null}
      <div className="verification-grid">
        <StatusCard title="Google" value="Đã liên kết" tone="success" />
        <StatusCard
          title="Số điện thoại"
          value={
            user.phoneStatus === "VERIFIED" ? "Đã xác minh" : "Chưa xác minh"
          }
          detail={user.phoneMasked ?? undefined}
          tone={user.phoneStatus === "VERIFIED" ? "success" : "warning"}
          action={
            user.phoneStatus === "VERIFIED"
              ? undefined
              : { href: "/onboarding/phone", label: "Thêm số điện thoại" }
          }
        />
        <StatusCard title="eKYC" value="Tạm hoãn" tone="neutral" />
        <StatusCard
          title="Quyền tài xế"
          value={
            simulated
              ? "Đã mở quyền thử nghiệm"
              : user.driverApprovalEvidence === "REAL"
                ? "Đã duyệt"
                : "Chưa được duyệt"
          }
          tone={simulated ? "warning" : "neutral"}
          action={{ href: "/trips/new", label: "Kiểm tra quyền tạo chuyến" }}
        />
        <StatusCard
          title="Phương tiện"
          value={simulated ? "Phương tiện thử nghiệm" : "Chưa có phương tiện"}
          tone={simulated ? "warning" : "neutral"}
        />
      </div>
    </main>
  );
}

function StatusCard({
  title,
  value,
  detail,
  tone,
  action,
}: {
  title: string;
  value: string;
  detail?: string;
  tone: "success" | "warning" | "neutral";
  action?: { href: string; label: string };
}) {
  return (
    <Card className="verification-card">
      <p>{title}</p>
      <strong className={`status-pill status-pill--${tone}`}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
      {action ? <Link href={action.href}>{action.label}</Link> : null}
    </Card>
  );
}
