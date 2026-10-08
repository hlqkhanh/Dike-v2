"use client";

import { Card } from "@dike/web-ui";
import { useQuery } from "@tanstack/react-query";

import { authApi } from "../../src/auth/api";

export default function VerificationPage() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });

  if (session.isPending) {
    return (
      <main className="settings-page">
        <p role="status">Đang tải trạng thái tài khoản…</p>
      </main>
    );
  }
  if (session.isError || !session.data) {
    return (
      <main className="settings-page">
        <p role="alert">Không thể tải trạng thái. Vui lòng thử lại.</p>
      </main>
    );
  }

  const user = session.data.user;
  const simulated = user.accessMode === "SIMULATED";
  return (
    <main className="settings-page">
      <p className="eyebrow">Minh bạch trạng thái</p>
      <h1>Xác minh và quyền truy cập</h1>
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
        />
        <StatusCard title="eKYC" value="Tạm hoãn" tone="neutral" />
        <StatusCard
          title="Quyền tài xế"
          value={
            simulated
              ? "Tài xế thử nghiệm"
              : user.driverApprovalEvidence === "REAL"
                ? "Đã duyệt"
                : "Chưa được duyệt"
          }
          tone={simulated ? "warning" : "neutral"}
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
}: {
  title: string;
  value: string;
  detail?: string;
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <Card className="verification-card">
      <p>{title}</p>
      <strong className={`status-pill status-pill--${tone}`}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </Card>
  );
}
