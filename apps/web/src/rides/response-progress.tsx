"use client";

import type { RidePostResponse } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  CreditCard,
  Landmark,
  MapPin,
  Navigation,
  Play,
  Route,
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
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "PAYOS" | null>(
    null,
  );
  const driverId =
    response.action === "REQUEST_RIDE"
      ? response.ownerId
      : response.requesterId;
  const isDriver = currentUserId === driverId;
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
  });
  const bankPayment = useQuery({
    queryKey: ["payment", response.id],
    queryFn: () => journeyApi.payment(response.id),
    enabled: response.status === "COMPLETED",
    retry: false,
  });
  const checkout = useMutation({
    mutationFn: () => journeyApi.createPaymentCheckout(response.id),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["payment", response.id] });
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    },
  });
  const confirmCash = useMutation({
    mutationFn: (kind: "paid" | "received") =>
      journeyApi.acknowledgePayment(response.id, kind, true),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["cash-payment", response.id],
      });
    },
  });

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
            ? cashPayment.data?.locked || bankPayment.data?.bankVerified
              ? "Đã thanh toán"
              : "Chờ thanh toán"
            : steps[Math.max(0, activeIndex)]?.label}
        </strong>
      </header>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const complete =
            step.status === "PAYMENT"
              ? Boolean(
                  cashPayment.data?.locked || bankPayment.data?.bankVerified,
                )
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
        <>
          <button
            className="response-payment-toggle"
            type="button"
            aria-expanded={paymentOpen}
            onClick={(event) => {
              event.stopPropagation();
              setPaymentOpen((value) => {
                if (value) setPaymentMethod(null);
                return !value;
              });
            }}
          >
            <Banknote aria-hidden="true" size={17} />
            {paymentOpen ? "Ẩn thanh toán" : "Thanh toán chuyến đi"}
          </button>
          {paymentOpen ? (
            <div
              className="response-payment-flow"
              onClick={(event) => event.stopPropagation()}
            >
              {paymentMethod === null ? (
                <div className="response-payment-choices">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                  >
                    <span>
                      <Banknote aria-hidden="true" size={27} />
                    </span>
                    <b>
                      Tiền mặt
                      <small>Thanh toán trực tiếp cho người đồng hành</small>
                    </b>
                    <i aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("PAYOS")}
                  >
                    <span>
                      <Landmark aria-hidden="true" size={27} />
                    </span>
                    <b>
                      Chuyển khoản
                      <small>Thanh toán qua tài khoản ngân hàng</small>
                    </b>
                    <i aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="response-payment-confirmation">
                  <button
                    className="response-payment-back"
                    type="button"
                    onClick={() => setPaymentMethod(null)}
                  >
                    ← Quay lại
                  </button>
                  <h3>
                    {paymentMethod === "CASH"
                      ? "Thanh toán tiền mặt"
                      : "Thanh toán chuyển khoản"}
                  </h3>
                  <div className="response-payment-notice">
                    {paymentMethod === "CASH" ? (
                      <Banknote aria-hidden="true" />
                    ) : (
                      <Landmark aria-hidden="true" />
                    )}
                    <span>
                      <strong>
                        Bạn đã chọn{" "}
                        {paymentMethod === "CASH"
                          ? "thanh toán bằng tiền mặt"
                          : "thanh toán bằng chuyển khoản"}
                      </strong>
                      <small>
                        {paymentMethod === "CASH"
                          ? "Vui lòng thanh toán trực tiếp cho người đồng hành sau khi hoàn thành chuyến đi."
                          : "Thông tin giao dịch sẽ được xác nhận tự động qua payOS."}
                      </small>
                    </span>
                  </div>
                  <section className="response-payment-summary">
                    <strong>Thông tin thanh toán</strong>
                    <span>Chuyến đi đã hoàn thành</span>
                    <b>
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(
                        cashPayment.data?.amountVnd ??
                          bankPayment.data?.amountVnd ??
                          0,
                      )}
                    </b>
                    <small>Số tiền đóng góp cho người đồng hành</small>
                  </section>
                  {paymentMethod === "CASH" ? (
                    cashPayment.isPending ? (
                      <p role="status">Đang tải thông tin thanh toán…</p>
                    ) : cashPayment.isError ? (
                      <p role="alert">{cashPayment.error.message}</p>
                    ) : cashPayment.data ? (
                      <>
                        <div className="response-cash-status">
                          <span
                            className={
                              cashPayment.data.passengerPaidAt
                                ? "is-complete"
                                : ""
                            }
                          >
                            <Check aria-hidden="true" size={14} /> Người đi ké
                            đã trả
                          </span>
                          <span
                            className={
                              cashPayment.data.driverReceivedAt
                                ? "is-complete"
                                : ""
                            }
                          >
                            <Check aria-hidden="true" size={14} /> Người chở đã
                            nhận
                          </span>
                        </div>
                        {!isDriver && !cashPayment.data.passengerPaidAt ? (
                          <button
                            className="response-payment-submit"
                            type="button"
                            disabled={confirmCash.isPending}
                            onClick={() => confirmCash.mutate("paid")}
                          >
                            Xác nhận đã thanh toán tiền mặt
                          </button>
                        ) : null}
                        {isDriver &&
                        cashPayment.data.passengerPaidAt &&
                        !cashPayment.data.driverReceivedAt ? (
                          <button
                            className="response-payment-submit"
                            type="button"
                            disabled={confirmCash.isPending}
                            onClick={() => confirmCash.mutate("received")}
                          >
                            Xác nhận đã nhận tiền
                          </button>
                        ) : null}
                        {isDriver && !cashPayment.data.passengerPaidAt ? (
                          <p>Đang chờ người đi ké xác nhận đã trả tiền.</p>
                        ) : null}
                        {cashPayment.data.locked ? (
                          <p className="is-success">
                            Hai bên đã hoàn tất xác nhận thanh toán.
                          </p>
                        ) : null}
                      </>
                    ) : null
                  ) : bankPayment.isPending ? (
                    <p role="status">Đang tải thông tin chuyển khoản…</p>
                  ) : bankPayment.isError ? (
                    <p role="alert">{bankPayment.error.message}</p>
                  ) : bankPayment.data ? (
                    <>
                      {!isDriver && !bankPayment.data.bankVerified ? (
                        <button
                          className="response-payment-submit"
                          type="button"
                          disabled={
                            !bankPayment.data.providerAvailable ||
                            checkout.isPending
                          }
                          onClick={() => checkout.mutate()}
                        >
                          {checkout.isPending
                            ? "Đang tạo giao dịch…"
                            : bankPayment.data.providerAvailable
                              ? "Tiếp tục thanh toán qua payOS"
                              : "payOS chưa được cấu hình"}
                        </button>
                      ) : null}
                      {isDriver && !bankPayment.data.bankVerified ? (
                        <p>Đang chờ người đi ké hoàn tất chuyển khoản.</p>
                      ) : null}
                      {bankPayment.data.bankVerified ? (
                        <p className="is-success">
                          Ngân hàng đã xác nhận giao dịch thành công.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  {confirmCash.isError ? (
                    <p role="alert">{confirmCash.error.message}</p>
                  ) : null}
                  {checkout.isError ? (
                    <p role="alert">{checkout.error.message}</p>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
      {update.isError ? <p role="alert">{update.error.message}</p> : null}
    </section>
  );
}

export const isActiveResponse = (response: RidePostResponse) =>
  ["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
    response.status,
  );
