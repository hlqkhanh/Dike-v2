"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authApi } from "../../../src/auth/api";
import { onboardingDestination } from "../../../src/auth/onboarding-destination";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";
import { ErrorState, LoadingState } from "../../components/app-ui";

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
    <main className="settings-page consent-page">
      <header className="consent-hero">
        <div>
          <p>Minh bạch và an toàn</p>
          <h1>Đồng ý và tài liệu</h1>
          <span>
            Mỗi quyết định được lưu theo đúng phiên bản để bạn luôn kiểm soát dữ
            liệu của mình.
          </span>
        </div>
        <span aria-hidden="true">
          <ShieldCheck size={43} />
        </span>
      </header>
      {summary.data ? (
        <section className="consent-progress">
          <div>
            <strong>
              {summary.data.requirements.filter((item) => item.accepted).length}
              /{summary.data.requirements.length} tài liệu đã hoàn tất
            </strong>
            <span>
              {allRequiredConsentsAccepted
                ? "Bạn đã hoàn thành tất cả yêu cầu."
                : "Hoàn thành các mục còn lại để tiếp tục."}
            </span>
          </div>
          <progress
            max={summary.data.requirements.length}
            value={
              summary.data.requirements.filter((item) => item.accepted).length
            }
          />
        </section>
      ) : null}
      <div className="consent-document-grid">
        {summary.isPending ? (
          <LoadingState label="Đang tải tài liệu đồng ý" />
        ) : summary.isError ? (
          <ErrorState
            message={summary.error.message}
            onRetry={() => void summary.refetch()}
          />
        ) : (
          summary.data.requirements.map((requirement) => (
            <article
              className={`consent-document-card${requirement.accepted ? " is-accepted" : ""}`}
              key={`${requirement.type}-${requirement.version}`}
            >
              <span className="consent-document-icon">
                <FileCheck2 size={24} />
              </span>
              <div className="consent-document-copy">
                <small>Phiên bản {requirement.version}</small>
                <h2>{labels[requirement.type] ?? requirement.type}</h2>
                <p>
                  {requirement.accepted
                    ? "Bạn đã chấp nhận phiên bản hiện tại."
                    : "Cần xem và chấp nhận để tiếp tục sử dụng đầy đủ tính năng."}
                </p>
              </div>
              {requirement.documentUrl ? (
                <a
                  href={requirement.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Đọc tài liệu <ExternalLink size={14} />
                </a>
              ) : null}
              {!requirement.accepted ? (
                <button
                  className="consent-accept-button"
                  type="button"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate(requirement.type)}
                >
                  Tôi đồng ý <ChevronRight size={15} />
                </button>
              ) : (
                <span className="consent-accepted">
                  <Check size={15} /> Đã ghi nhận
                </span>
              )}
            </article>
          ))
        )}
      </div>
      {advanceError ? (
        <p className="auth-error" role="alert">
          Không thể chuyển sang bước tiếp theo. Vui lòng tải lại trang.
        </p>
      ) : null}
      {summary.data?.receipts.length ? (
        <section className="receipt-list consent-receipts">
          <h2>
            <Clock3 size={19} /> Lịch sử gần đây
          </h2>
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
