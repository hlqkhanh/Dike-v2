"use client";

import type { RidePostResponse } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  MapPin,
  Navigation,
  Play,
  Route,
  X,
} from "lucide-react";
import { useState } from "react";

import { journeyApi } from "../journey/api";
import { rideApi } from "./api";

const steps = [
  { status: "ACCEPTED", label: "Đã xác nhận", icon: Check },
  { status: "DRIVER_STARTED", label: "Đang đến đón", icon: Play },
  { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón", icon: MapPin },
  { status: "COMPLETED", label: "Hoàn thành", icon: Navigation },
  { status: "PAYMENT", label: "Thanh toán", icon: CreditCard },
] as const;

const PRICE_PER_KM_VND = 2_000;

type ProgressStatus = Exclude<(typeof steps)[number]["status"], "PAYMENT">;

export function ResponseProgress({
  response,
  currentUserId,
  compact = false,
  onUpdated,
}: {
  response: RidePostResponse;
  currentUserId: string;
  compact?: boolean;
  onUpdated?: () => void;
}) {
  const client = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("CASH");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const driverId =
    response.action === "REQUEST_RIDE"
      ? response.ownerId
      : response.requesterId;
  const passengerId =
    response.action === "REQUEST_RIDE"
      ? response.requesterId
      : response.ownerId;
  const isDriver = currentUserId === driverId;
  const isPassenger = currentUserId === passengerId;
  const activeIndex = steps.findIndex(
    (step) => step.status === response.status,
  );
  const next =
    response.status === "ACCEPTED"
      ? { status: "DRIVER_STARTED" as const, label: "Bắt đầu đi" }
      : response.status === "DRIVER_STARTED"
        ? { status: "DRIVER_ARRIVED" as const, label: "Đã đến điểm đón" }
        : response.status === "DRIVER_ARRIVED"
          ? { status: "COMPLETED" as const, label: "Hoàn thành chuyến" }
          : null;
  const update = useMutation({
    mutationFn: (status: ProgressStatus) =>
      rideApi.decidePostResponse(response.id, response.version, status),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["feed", "responses", response.postId],
      });
      onUpdated?.();
    },
  });
  const cashPayment = useQuery({
    queryKey: ["cash-payment", response.id],
    queryFn: () => journeyApi.cashPayment(response.id),
    enabled: response.status === "COMPLETED",
    retry: false,
    refetchInterval: response.status === "COMPLETED" ? 5_000 : false,
  });
  const bankPayment = useQuery({
    queryKey: ["payment", response.id],
    queryFn: () => journeyApi.payment(response.id),
    enabled: response.status === "COMPLETED",
    retry: false,
    refetchInterval: response.status === "COMPLETED" ? 5_000 : false,
  });
  const confirmCash = useMutation({
    mutationFn: (kind: "paid" | "received") =>
      journeyApi.acknowledgePayment(response.id, kind, true),
    onSuccess: async () => {
      setPaymentOpen(false);
      setConfirmingPayment(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["cash-payment", response.id] }),
        client.invalidateQueries({ queryKey: ["payment", response.id] }),
      ]);
    },
  });
  const paid = Boolean(
    cashPayment.data?.locked || bankPayment.data?.bankVerified,
  );
  const passengerReportedPaid = Boolean(
    cashPayment.data?.passengerPaidAt || bankPayment.data?.bankVerified,
  );
  const amountVnd =
    cashPayment.data?.amountVnd ?? bankPayment.data?.amountVnd ?? 0;
  const distanceKm = amountVnd / PRICE_PER_KM_VND;
  const closePayment = () => {
    if (confirmCash.isPending) return;
    setPaymentOpen(false);
    setConfirmingPayment(false);
  };

  return (
    <section
      className={`response-progress ${compact ? "is-compact" : ""}`}
      aria-label="Tiến độ chuyến đi"
    >
      <header>
        <span>
          <Route aria-hidden="true" size={18} />
          Tiến độ chuyến đi
        </span>
        <strong>
          {response.status === "COMPLETED"
            ? paid
              ? "Đã thanh toán"
              : passengerReportedPaid
                ? "Chờ xác nhận"
                : "Chờ thanh toán"
            : steps[Math.max(0, activeIndex)]?.label}
        </strong>
      </header>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const complete =
            step.status === "PAYMENT"
              ? paid
              : activeIndex >= index;
          return (
            <li className={complete ? "is-complete" : ""} key={step.status}>
              <i>
                <Icon aria-hidden="true" size={compact ? 13 : 15} />
              </i>
              <small>{step.label}</small>
            </li>
          );
        })}
      </ol>
      {isDriver && next && !compact ? (
        <button
          type="button"
          disabled={update.isPending}
          onClick={(event) => {
            event.stopPropagation();
            update.mutate(next.status);
          }}
        >
          {update.isPending ? "Đang cập nhật…" : next.label}
        </button>
      ) : null}
      {!isDriver && !compact && response.status !== "COMPLETED" ? (
        <p>Bạn sẽ nhận thông báo khi người chở cập nhật hành trình.</p>
      ) : null}
      {response.status === "COMPLETED" && !compact ? (
        paid ? (
          <div className="response-payment-success" role="status">
            <Check aria-hidden="true" size={17} />
            Hai bên đã hoàn tất thanh toán.
          </div>
        ) : (
          <>
            {isPassenger && !passengerReportedPaid ? (
              <button
                className="response-payment-toggle"
                type="button"
                aria-haspopup="dialog"
                onClick={(event) => {
                  event.stopPropagation();
                  setPaymentMethod("CASH");
                  setConfirmingPayment(false);
                  setPaymentOpen(true);
                }}
              >
                <CreditCard aria-hidden="true" size={18} />
                Thanh toán
              </button>
            ) : isDriver && passengerReportedPaid ? (
              <button
                className="response-payment-toggle"
                type="button"
                disabled={confirmCash.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  confirmCash.mutate("received");
                }}
              >
                <Check aria-hidden="true" size={18} />
                {confirmCash.isPending ? "Đang xác nhận…" : "Đã nhận"}
              </button>
            ) : (
              <div className="response-payment-waiting" role="status">
                <CreditCard aria-hidden="true" size={17} />
                {isDriver
                  ? "Đang chờ người đi ké xác nhận thanh toán."
                  : "Đã xác nhận thanh toán. Đang chờ người chở bấm “Đã nhận”."}
              </div>
            )}

            {paymentOpen ? (
              <div
                className="response-payment-modal-backdrop"
                role="presentation"
                onClick={closePayment}
              >
                <section
                  className="response-payment-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="response-payment-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <div>
                      <h2 id="response-payment-title">
                        {confirmingPayment
                          ? "Xác nhận thanh toán"
                          : "Chọn phương thức thanh toán"}
                      </h2>
                      <p>
                        {confirmingPayment
                          ? "Kiểm tra số tiền trước khi xác nhận với người chở."
                          : "Vui lòng chọn cách thanh toán cho chuyến đi này."}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Đóng thanh toán"
                      disabled={confirmCash.isPending}
                      onClick={closePayment}
                    >
                      <X aria-hidden="true" size={21} />
                    </button>
                  </header>

                  {confirmingPayment ? (
                    <div className="response-payment-confirmation">
                      <div className="response-payment-notice">
                        {paymentMethod === "CASH" ? (
                          <Banknote aria-hidden="true" />
                        ) : (
                          <Landmark aria-hidden="true" />
                        )}
                        <span>
                          <strong>
                            {paymentMethod === "CASH"
                              ? "Thanh toán tiền mặt"
                              : "Thanh toán chuyển khoản"}
                          </strong>
                          <small>
                            {paymentMethod === "CASH"
                              ? "Thanh toán trực tiếp cho người chở."
                              : "Chuyển khoản cho người chở theo thông tin hai bên thống nhất."}
                          </small>
                        </span>
                      </div>
                      <section className="response-payment-summary">
                        <strong>Số tiền cần thanh toán</strong>
                        <b>
                          {new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                          }).format(amountVnd)}
                        </b>
                        <small>
                          {distanceKm.toLocaleString("vi-VN", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          km × {PRICE_PER_KM_VND.toLocaleString("vi-VN")} đ/km
                        </small>
                      </section>
                      <section className="response-payment-guide">
                        <strong>Hướng dẫn thanh toán</strong>
                        <span>1. Kiểm tra đúng quãng đường và số tiền.</span>
                        <span>
                          2. {paymentMethod === "CASH"
                            ? "Trả tiền trực tiếp cho người chở."
                            : "Hoàn tất chuyển khoản cho người chở."}
                        </span>
                        <span>
                          3. Bấm xác nhận và chờ người chở bấm “Đã nhận”.
                        </span>
                      </section>
                      {confirmCash.isError ? (
                        <p role="alert">{confirmCash.error.message}</p>
                      ) : null}
                      <button
                        className="response-payment-submit"
                        type="button"
                        disabled={confirmCash.isPending || amountVnd <= 0}
                        onClick={() => confirmCash.mutate("paid")}
                      >
                        <Check aria-hidden="true" size={18} />
                        {confirmCash.isPending
                          ? "Đang xác nhận…"
                          : paymentMethod === "CASH"
                            ? "Xác nhận đã thanh toán tiền mặt"
                            : "Xác nhận đã chuyển khoản"}
                      </button>
                      <button
                        className="response-payment-back"
                        type="button"
                        disabled={confirmCash.isPending}
                        onClick={() => setConfirmingPayment(false)}
                      >
                        <ArrowLeft aria-hidden="true" size={17} /> Quay lại
                      </button>
                    </div>
                  ) : (
                    <div className="response-payment-picker">
                      <div
                        className="response-payment-choices"
                        role="radiogroup"
                        aria-label="Phương thức thanh toán"
                      >
                        <button
                          className={paymentMethod === "CASH" ? "is-selected" : ""}
                          type="button"
                          role="radio"
                          aria-checked={paymentMethod === "CASH"}
                          onClick={() => setPaymentMethod("CASH")}
                        >
                          <span><Banknote aria-hidden="true" size={29} /></span>
                          <b>Tiền mặt<small>Thanh toán trực tiếp cho người đồng hành</small></b>
                          <i aria-hidden="true" />
                        </button>
                        <button
                          className={paymentMethod === "BANK" ? "is-selected" : ""}
                          type="button"
                          role="radio"
                          aria-checked={paymentMethod === "BANK"}
                          onClick={() => setPaymentMethod("BANK")}
                        >
                          <span><Landmark aria-hidden="true" size={29} /></span>
                          <b>Chuyển khoản<small>Thanh toán qua tài khoản ngân hàng</small></b>
                          <i aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        className="response-payment-continue"
                        type="button"
                        onClick={() => setConfirmingPayment(true)}
                      >
                        Tiếp tục
                      </button>
                    </div>
                  )}
                </section>
              </div>
            ) : null}
          </>
        )
      ) : null}
      {confirmCash.isError && !paymentOpen ? (
        <p role="alert">{confirmCash.error.message}</p>
      ) : null}
      {update.isError ? <p role="alert">{update.error.message}</p> : null}
    </section>
  );
}

export const isActiveResponse = (response: RidePostResponse) =>
  ["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
    response.status,
  );
