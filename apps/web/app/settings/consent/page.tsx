"use client";

import { Button, Card } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authApi } from "../../../src/auth/api";
import { onboardingDestination } from "../../../src/auth/onboarding-destination";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";

const labels: Record<string, string> = {
  TERMS: "Điều khoản sử dụng",
  PRIVACY_NOTICE: "Thông báo quyền riêng tư",
  AGE_18_ATTESTATION: "Xác nhận đủ 18 tuổi",
};

export default function ConsentPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [advanceError, setAdvanceError] = useState(false);
  const summary = useQuery({
    queryKey: ["consents", "me"],
    queryFn: profileApi.consents,
  });
  const accept = useMutation({
    mutationFn: (type: string) => profileApi.acceptConsent(type),
    onSuccess: () => client.invalidateQueries({ queryKey: ["consents", "me"] }),
  });
  useAuthFailure(summary.error);
  useAuthFailure(accept.error);

  const allRequiredConsentsAccepted =
    Boolean(summary.data?.requirements.length) &&
    summary.data!.requirements.every((requirement) => requirement.accepted);

  useEffect(() => {
    const onboardingFlow =
      new URLSearchParams(window.location.search).get("flow") === "onboarding";
    if (!onboardingFlow || !allRequiredConsentsAccepted) return;

    let cancelled = false;
    const advance = async () => {
      try {
        setAdvanceError(false);
        await client.invalidateQueries({ queryKey: ["auth", "session"] });
        const current = await client.fetchQuery({
          queryKey: ["auth", "session"],
          queryFn: authApi.session,
        });
        if (!cancelled) {
          router.replace(onboardingDestination(current.user.nextAction));
        }
      } catch {
        if (!cancelled) setAdvanceError(true);
      }
    };
    void advance();
    return () => {
      cancelled = true;
    };
  }, [allRequiredConsentsAccepted, client, router]);

  return (
    <main className="settings-page">
      <header>
        <p className="eyebrow">Minh bạch</p>
        <h1>Đồng ý và tài liệu</h1>
        <p className="settings-copy">
          Mỗi quyết định được ghi thành receipt riêng theo đúng phiên bản tài
          liệu.
        </p>
      </header>
      <div className="settings-grid">
        {summary.isPending ? (
          <p>Đang tải…</p>
        ) : summary.isError ? (
          <p className="auth-error">Không thể tải trạng thái đồng ý.</p>
        ) : (
          summary.data.requirements.map((requirement) => (
            <Card
              className="settings-card"
              key={`${requirement.type}-${requirement.version}`}
            >
              <p className="eyebrow">Phiên bản {requirement.version}</p>
              <h2>{labels[requirement.type] ?? requirement.type}</h2>
              <p>
                {requirement.accepted
                  ? "Bạn đã chấp nhận phiên bản hiện tại."
                  : "Cần xem và chấp nhận để tiếp tục sử dụng đầy đủ tính năng."}
              </p>
              {requirement.documentUrl ? (
                <a
                  href={requirement.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Đọc tài liệu
                </a>
              ) : null}
              {!requirement.accepted ? (
                <Button
                  type="button"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate(requirement.type)}
                >
                  Tôi đồng ý
                </Button>
              ) : (
                <span className="dike-status dike-status--success">
                  Đã ghi nhận
                </span>
              )}
            </Card>
          ))
        )}
      </div>
      {advanceError ? (
        <p className="auth-error" role="alert">
          Không thể chuyển sang bước tiếp theo. Vui lòng tải lại trang.
        </p>
      ) : null}
      {summary.data?.receipts.length ? (
        <section className="receipt-list">
          <h2>Lịch sử gần đây</h2>
          {summary.data.receipts.map((receipt) => (
            <p key={receipt.id}>
              {labels[receipt.type] ?? receipt.type} · {receipt.decision} ·{" "}
              <time>
                {new Date(receipt.occurredAt).toLocaleString("vi-VN")}
              </time>
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}
