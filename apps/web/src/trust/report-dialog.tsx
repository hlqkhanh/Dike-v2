"use client";

import { useMutation } from "@tanstack/react-query";
import { Flag, X } from "lucide-react";
import { useRef, useState } from "react";
import { journeyApi } from "../journey/api";

const reasons = [
  ["SPAM", "Spam hoặc quảng cáo"],
  ["HARASSMENT", "Quấy rối"],
  ["UNSAFE", "Hành vi không an toàn"],
  ["MISLEADING", "Thông tin sai lệch"],
  ["PRIVACY", "Xâm phạm quyền riêng tư"],
  ["OTHER", "Lý do khác"],
] as const;

export function ReportDialog({
  targetType,
  targetId,
  contextBookingId,
}: {
  targetType: "USER" | "POST" | "MESSAGE" | "TRIP" | "REVIEW";
  targetId: string;
  contextBookingId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("UNSAFE");
  const [note, setNote] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      journeyApi.report({
        targetType,
        targetId,
        contextBookingId,
        reason,
        note: note.trim() || undefined,
      }),
    onSuccess: () => setNote(""),
  });
  return (
    <>
      <button
        className="app-button app-button--secondary"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        <Flag aria-hidden="true" size={16} /> Báo cáo
      </button>
      <dialog
        className="report-dialog"
        ref={dialog}
        onClose={() => submit.reset()}
      >
        <form
          method="dialog"
          className="report-dialog-card"
          onSubmit={(event) => {
            if (
              (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "cancel"
            )
              return;
            event.preventDefault();
            submit.mutate();
          }}
        >
          <div className="report-dialog-heading">
            <div>
              <p className="app-eyebrow">An toàn cộng đồng</p>
              <h2>Báo cáo nội dung</h2>
            </div>
            <button
              className="app-icon-button"
              value="cancel"
              aria-label="Đóng"
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>
          {submit.isSuccess ? (
            <div className="report-success" role="status">
              <strong>Đã nhận báo cáo</strong>
              <p>
                Đội ngũ kiểm duyệt sẽ xem xét. Báo cáo không tự động khóa tài
                khoản.
              </p>
              <button className="app-button" value="cancel">
                Hoàn tất
              </button>
            </div>
          ) : (
            <>
              <label className="dike-field">
                <span>Lý do</span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {reasons.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="dike-field">
                <span>Mô tả thêm</span>
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Không cung cấp thông tin nhạy cảm"
                />
              </label>
              {submit.isError ? (
                <p className="auth-error" role="alert">
                  Không thể gửi báo cáo. Có thể báo cáo này đã được gửi trước
                  đó.
                </p>
              ) : null}
              <div className="report-dialog-actions">
                <button
                  className="app-button app-button--secondary"
                  value="cancel"
                >
                  Hủy
                </button>
                <button
                  className="app-button app-button--danger"
                  type="submit"
                  disabled={submit.isPending}
                >
                  {submit.isPending ? "Đang gửi…" : "Gửi báo cáo"}
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
