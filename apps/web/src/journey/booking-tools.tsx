"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LocateFixed,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useState } from "react";
import { journeyApi } from "./api";

const paymentNames: Record<string, string> = {
  UNAVAILABLE: "Chưa cấu hình",
  NOT_STARTED: "Chưa thanh toán",
  PENDING: "Đang chờ thanh toán",
  PAID: "Ngân hàng đã xác nhận",
  PASSENGER_PAID: "Hành khách đã thanh toán",
  DRIVER_RECEIVED: "Tài xế đã xác nhận nhận tiền",
  CONFIRMED: "Đã đối soát",
  COMPLETED: "Đã đối soát",
};
const publicationNames: Record<string, string> = {
  PENDING: "Đang chờ hiển thị",
  PUBLISHED: "Đã công khai",
  HIDDEN: "Đã ẩn",
};
const ratingLabels = [
  "",
  "Rất tệ",
  "Chưa tốt",
  "Bình thường",
  "Tốt",
  "Tuyệt vời",
];
const timeLabel = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa xác nhận";

export function BookingTools({
  bookingId,
  driver,
  bookingStatus,
}: {
  bookingId: string;
  driver: boolean;
  bookingStatus?: string;
}) {
  const client = useQueryClient();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [locationConsent, setLocationConsent] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const [bankBin, setBankBin] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PAYOS" | "CASH">("PAYOS");
  const terminal = Boolean(
    bookingStatus &&
      ["COMPLETED", "CANCELLED", "NO_SHOW", "ENDED_EARLY"].includes(
        bookingStatus,
      ),
  );
  const locationAvailable =
    !bookingStatus ||
    ["CONFIRMED", "DRIVER_ARRIVED", "BOARDED", "IN_PROGRESS"].includes(
      bookingStatus,
    );
  const payment = useQuery({
    queryKey: ["payment", bookingId],
    queryFn: () => journeyApi.payment(bookingId),
    retry: false,
  });
  const cashPayment = useQuery({
    queryKey: ["cash-payment", bookingId],
    queryFn: () => journeyApi.cashPayment(bookingId),
    retry: false,
  });
  const eligibility = useQuery({
    queryKey: ["review-eligibility", bookingId],
    queryFn: () => journeyApi.reviewEligibility(bookingId),
    retry: false,
  });
  const reviews = useQuery({
    queryKey: ["booking-reviews", bookingId],
    queryFn: () => journeyApi.bookingReviews(bookingId),
    retry: false,
  });
  const locations = useQuery({
    queryKey: ["live-location", bookingId],
    queryFn: () => journeyApi.liveLocations(bookingId),
    enabled: locationAvailable,
    refetchInterval: locationAvailable ? 10000 : false,
    retry: false,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["payment", bookingId] }),
      client.invalidateQueries({ queryKey: ["cash-payment", bookingId] }),
      client.invalidateQueries({ queryKey: ["review-eligibility", bookingId] }),
      client.invalidateQueries({ queryKey: ["booking-reviews", bookingId] }),
      client.invalidateQueries({ queryKey: ["live-location", bookingId] }),
    ]);
  };
  const command = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const checkout = useMutation({
    mutationFn: () => journeyApi.createPaymentCheckout(bookingId),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["payment", bookingId] });
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    },
  });
  const payout = useMutation({
    mutationFn: () =>
      journeyApi.requestPaymentPayout(bookingId, bankBin, accountNumber),
    onSuccess: async () => {
      setAccountNumber("");
      await client.invalidateQueries({ queryKey: ["payment", bookingId] });
    },
  });
  const confirmCash = useMutation({
    mutationFn: (kind: "paid" | "received") =>
      journeyApi.acknowledgePayment(bookingId, kind, true),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["cash-payment", bookingId],
      });
    },
  });

  const cashStarted = Boolean(
    cashPayment.data && cashPayment.data.status !== "NONE",
  );
  const selectedPaymentMethod =
    payment.data?.bankVerified || payment.data?.status === "PENDING"
      ? "PAYOS"
      : driver && cashStarted
        ? "CASH"
        : payment.data?.providerAvailable
          ? paymentMethod
          : "CASH";

  const updateConsent = (enabled: boolean) => {
    setLocationError("");
    command.mutate(() => journeyApi.locationConsent(bookingId, enabled), {
      onSuccess: () => setLocationConsent(enabled),
    });
  };
  const sharePosition = () => {
    setLocationError("");
    if (!locationConsent) {
      setLocationError(
        "Hãy bật đồng ý chia sẻ vị trí trước khi gửi vị trí hiện tại.",
      );
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationError("Trình duyệt này không hỗ trợ định vị.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        command.mutate(() =>
          journeyApi.updateLiveLocation(
            bookingId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          ),
        ),
      (error) =>
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Quyền vị trí đang bị chặn. Hãy cho phép truy cập trong cài đặt trình duyệt rồi thử lại."
            : "Không thể lấy vị trí hiện tại. Hãy kiểm tra GPS và thử lại.",
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  };

  return (
    <div className="journey-tools" aria-label="Tiện ích hành trình">
      <section className="settings-card journey-tool-card">
        <div className="journey-tool-heading">
          <span className="journey-heading-icon">
            <CircleDollarSign aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="app-eyebrow">Đối soát minh bạch</p>
            <h2>Khoản đóng góp chuyến đi</h2>
          </div>
          {payment.data ? (
            <span
              className={`journey-state-pill${
                payment.data.bankVerified || cashPayment.data?.locked
                  ? " is-success"
                  : ""
              }`}
            >
              {selectedPaymentMethod === "CASH"
                ? cashPayment.data?.locked
                  ? "Tiền mặt đã xác nhận"
                  : cashPayment.data?.passengerPaidAt
                    ? "Chờ tài xế xác nhận"
                    : "Thanh toán tiền mặt"
                : (paymentNames[payment.data.status] ?? "Đang xử lý")}
            </span>
          ) : null}
        </div>
        {payment.isPending ? (
          <p role="status">Đang tải thông tin thanh toán…</p>
        ) : payment.isError ? (
          <InlineError
            message={payment.error.message}
            retry={() => void payment.refetch()}
          />
        ) : payment.data ? (
          <>
            <strong className="journey-payment-amount">
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(payment.data.amountVnd)}
            </strong>
            {!driver &&
            !payment.data.bankVerified &&
            !cashPayment.data?.locked ? (
              <div
                className="journey-payment-methods"
                aria-label="Phương thức thanh toán"
              >
                <button
                  aria-pressed={selectedPaymentMethod === "PAYOS"}
                  disabled={!payment.data.providerAvailable || cashStarted}
                  type="button"
                  onClick={() => setPaymentMethod("PAYOS")}
                >
                  <CreditCard aria-hidden="true" size={19} />
                  <span>
                    <strong>Chuyển khoản</strong>
                    <small>payOS thử nghiệm</small>
                  </span>
                </button>
                <button
                  aria-pressed={selectedPaymentMethod === "CASH"}
                  disabled={payment.data.status === "PENDING"}
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                >
                  <Banknote aria-hidden="true" size={19} />
                  <span>
                    <strong>Tiền mặt</strong>
                    <small>Xác nhận giữa hai bên</small>
                  </span>
                </button>
              </div>
            ) : null}

            {selectedPaymentMethod === "CASH" ? (
              <>
                {cashPayment.isPending ? (
                  <p role="status">Đang tải xác nhận tiền mặt…</p>
                ) : cashPayment.isError ? (
                  <InlineError
                    message={cashPayment.error.message}
                    retry={() => void cashPayment.refetch()}
                  />
                ) : cashPayment.data ? (
                  <>
                    <div className="journey-confirmation-grid">
                      <div
                        className={
                          cashPayment.data.passengerPaidAt ? "is-complete" : ""
                        }
                      >
                        <Check aria-hidden="true" size={17} />
                        <span>
                          <strong>Người đi ké đã trả</strong>
                          <small>
                            {timeLabel(cashPayment.data.passengerPaidAt)}
                          </small>
                        </span>
                      </div>
                      <div
                        className={
                          cashPayment.data.driverReceivedAt ? "is-complete" : ""
                        }
                      >
                        <Check aria-hidden="true" size={17} />
                        <span>
                          <strong>Người chở đã nhận</strong>
                          <small>
                            {timeLabel(cashPayment.data.driverReceivedAt)}
                          </small>
                        </span>
                      </div>
                    </div>
                    <p className="journey-section-copy">
                      Thanh toán tiền mặt được hai thành viên tự xác nhận. Diké
                      không xác minh giao dịch này qua ngân hàng.
                    </p>
                    {!driver && !cashPayment.data.passengerPaidAt ? (
                      <button
                        className="app-button app-button--primary"
                        type="button"
                        disabled={confirmCash.isPending}
                        onClick={() => confirmCash.mutate("paid")}
                      >
                        {confirmCash.isPending
                          ? "Đang xác nhận…"
                          : "Tôi đã trả tiền mặt"}
                      </button>
                    ) : null}
                    {driver && !cashPayment.data.passengerPaidAt ? (
                      <p className="journey-empty-copy">
                        Đang chờ người đi ké xác nhận đã trả tiền mặt.
                      </p>
                    ) : null}
                    {driver &&
                    cashPayment.data.passengerPaidAt &&
                    !cashPayment.data.driverReceivedAt ? (
                      <button
                        className="app-button app-button--primary"
                        type="button"
                        disabled={confirmCash.isPending}
                        onClick={() => confirmCash.mutate("received")}
                      >
                        {confirmCash.isPending
                          ? "Đang xác nhận…"
                          : "Xác nhận đã nhận tiền"}
                      </button>
                    ) : null}
                    {cashPayment.data.locked ? (
                      <p className="success-notice" role="status">
                        Hai bên đã xác nhận hoàn tất thanh toán tiền mặt.
                      </p>
                    ) : null}
                    {confirmCash.isError ? (
                      <p className="journey-inline-error" role="alert">
                        {confirmCash.error.message}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <div className="journey-confirmation-grid">
                  <div
                    className={payment.data.bankVerified ? "is-complete" : ""}
                  >
                    <Check aria-hidden="true" size={17} />
                    <span>
                      <strong>Hành khách</strong>
                      <small>{timeLabel(payment.data.paidAt)}</small>
                    </span>
                  </div>
                  <div
                    className={payment.data.bankVerified ? "is-complete" : ""}
                  >
                    <Check aria-hidden="true" size={17} />
                    <span>
                      <strong>Đối soát ngân hàng</strong>
                      <small>
                        {payment.data.bankVerified
                          ? "Đã xác minh qua payOS"
                          : "Đang chờ"}
                      </small>
                    </span>
                  </div>
                </div>
                <p className="journey-section-copy">
                  Bản thử nghiệm chỉ ghi nhận chuyển khoản khi nhận được webhook
                  hợp lệ từ payOS.
                </p>
                {!driver && !payment.data.bankVerified ? (
                  <button
                    className="app-button app-button--primary"
                    type="button"
                    disabled={
                      checkout.isPending || !payment.data.providerAvailable
                    }
                    onClick={() => checkout.mutate()}
                  >
                    {checkout.isPending
                      ? "Đang tạo mã thanh toán…"
                      : payment.data.status === "PENDING"
                        ? "Tiếp tục thanh toán"
                        : "Thanh toán qua payOS"}
                  </button>
                ) : null}
                {driver && !payment.data.bankVerified ? (
                  <p className="journey-empty-copy">
                    Đang chờ hành khách thanh toán qua payOS.
                  </p>
                ) : null}
                {driver &&
                payment.data.bankVerified &&
                bookingStatus === "COMPLETED" &&
                !payment.data.payoutStatus ? (
                  <div className="journey-review-form">
                    <label>
                      Mã BIN ngân hàng nhận tiền
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={bankBin}
                        onChange={(event) =>
                          setBankBin(event.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Ví dụ: 970422"
                      />
                    </label>
                    <label>
                      Số tài khoản của tài xế
                      <input
                        inputMode="numeric"
                        maxLength={19}
                        value={accountNumber}
                        onChange={(event) =>
                          setAccountNumber(
                            event.target.value.replace(/\D/g, ""),
                          )
                        }
                      />
                    </label>
                    <button
                      className="app-button app-button--primary"
                      type="button"
                      disabled={
                        payout.isPending ||
                        bankBin.length !== 6 ||
                        accountNumber.length < 6
                      }
                      onClick={() => payout.mutate()}
                    >
                      {payout.isPending
                        ? "Đang tạo lệnh chi…"
                        : "Nhận tiền chuyến đi"}
                    </button>
                  </div>
                ) : null}
                {payment.data.payoutStatus ? (
                  <p className="success-notice" role="status">
                    Lệnh chi {payment.data.payoutStatus.toLowerCase()} ·{" "}
                    {payment.data.payoutDestination}
                  </p>
                ) : null}
                {checkout.isError ? (
                  <p className="journey-inline-error" role="alert">
                    {checkout.error.message}
                  </p>
                ) : null}
                {payout.isError ? (
                  <p className="journey-inline-error" role="alert">
                    {payout.error.message}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </section>

      <section className="settings-card journey-tool-card">
        <div className="journey-tool-heading">
          <span className="journey-heading-icon">
            <LocateFixed aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="app-eyebrow">An toàn trong chuyến đi</p>
            <h2>Chia sẻ vị trí</h2>
          </div>
          <span
            className={`journey-state-pill${locationConsent ? " is-live" : ""}`}
          >
            {locationConsent ? "Đang bật" : "Đang tắt"}
          </span>
        </div>
        {locationAvailable ? (
          <>
            <p className="journey-section-copy">
              Vị trí chỉ được chia sẻ với người đi cùng trong booking này. Bạn
              có thể dừng bất cứ lúc nào.
            </p>
            <div className="journey-action-row">
              <button
                className={`app-button ${locationConsent ? "app-button--secondary" : "app-button--primary"}`}
                type="button"
                disabled={command.isPending}
                onClick={() => updateConsent(!locationConsent)}
              >
                {locationConsent ? "Dừng chia sẻ" : "Cho phép chia sẻ"}
              </button>
              <button
                className="app-button app-button--secondary"
                type="button"
                disabled={command.isPending || !locationConsent}
                onClick={sharePosition}
              >
                <MapPin aria-hidden="true" size={17} /> Gửi vị trí hiện tại
              </button>
            </div>
            {locations.isPending ? <p role="status">Đang tải vị trí…</p> : null}
            {locations.isError ? (
              <InlineError
                message={locations.error.message}
                retry={() => void locations.refetch()}
              />
            ) : null}
            {locationError ? (
              <p className="journey-inline-error" role="alert">
                {locationError}
              </p>
            ) : null}
            {locations.data?.locations.length === 0 ? (
              <p className="journey-empty-copy">
                Chưa có vị trí nào được chia sẻ trong chuyến đi.
              </p>
            ) : null}
            <div className="journey-location-list">
              {locations.data?.locations.map((location) => (
                <article key={location.userId}>
                  <MapPin aria-hidden="true" size={18} />
                  <div>
                    <strong>Vị trí người đi cùng</strong>
                    <p>
                      {location.latitude.toFixed(5)},{" "}
                      {location.longitude.toFixed(5)}
                    </p>
                    <small>
                      <Clock3 aria-hidden="true" size={13} />{" "}
                      {location.stale
                        ? "Vị trí đã cũ"
                        : `Cập nhật ${timeLabel(location.updatedAt)}`}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="journey-empty-copy">
            Chia sẻ vị trí đã tự động dừng vì chuyến đi không còn hoạt động.
          </p>
        )}
      </section>

      <section className="settings-card journey-tool-card journey-review-card">
        <div className="journey-tool-heading">
          <span className="journey-heading-icon">
            <Star aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="app-eyebrow">Sau chuyến đi</p>
            <h2>Đánh giá người đi cùng</h2>
          </div>
        </div>
        {eligibility.isPending ? (
          <p role="status">Đang kiểm tra điều kiện đánh giá…</p>
        ) : null}
        {eligibility.isError ? (
          <InlineError
            message={eligibility.error.message}
            retry={() => void eligibility.refetch()}
          />
        ) : eligibility.data?.eligible && !reviewSent ? (
          <form
            className="journey-review-form"
            onSubmit={(event) => {
              event.preventDefault();
              command.mutate(
                () => journeyApi.submitReview(bookingId, stars, comment.trim()),
                {
                  onSuccess: () => {
                    setReviewSent(true);
                    setComment("");
                  },
                },
              );
            }}
          >
            <fieldset>
              <legend>Mức độ hài lòng</legend>
              <div className="journey-stars">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    aria-label={`${value} sao: ${ratingLabels[value]}`}
                    aria-pressed={stars === value}
                    key={value}
                    type="button"
                    onClick={() => setStars(value)}
                  >
                    <Star
                      aria-hidden="true"
                      size={25}
                      fill={value <= stars ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <span aria-live="polite">
                {stars} sao · {ratingLabels[stars]}
              </span>
            </fieldset>
            <label>
              Nhận xét <span>{comment.length}/1000</span>
              <textarea
                maxLength={1000}
                value={comment}
                placeholder="Chia sẻ trải nghiệm để cộng đồng đi cùng tốt hơn"
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <button
              className="app-button app-button--primary"
              disabled={command.isPending || !comment.trim()}
            >
              Gửi đánh giá
            </button>
          </form>
        ) : (
          <div className="journey-review-status" role="status">
            <ShieldCheck aria-hidden="true" size={20} />
            <p>
              {reviewSent || eligibility.data?.submitted
                ? "Cảm ơn bạn. Đánh giá đã được gửi và không thể gửi lại."
                : terminal
                  ? "Booking này hiện không đủ điều kiện đánh giá."
                  : "Đánh giá sẽ mở sau khi chuyến đi hoàn thành."}
            </p>
          </div>
        )}
        {reviews.isError ? <p role="alert">{reviews.error.message}</p> : null}
        {reviews.data && reviews.data.length > 0 ? (
          <div
            className="journey-review-list"
            aria-label="Đánh giá của chuyến đi"
          >
            {reviews.data.map((review) => (
              <article key={review.id}>
                <div>
                  <strong>{review.reviewerDisplayName}</strong>
                  <span aria-label={`${review.stars} sao`}>
                    {"★".repeat(review.stars)}
                    {"☆".repeat(5 - review.stars)}
                  </span>
                </div>
                {review.comment ? <p>{review.comment}</p> : null}
                <small>
                  {publicationNames[review.publicationStatus] ?? "Đang xử lý"}
                </small>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {command.isPending ? (
        <p className="form-hint" role="status">
          Đang lưu thay đổi…
        </p>
      ) : null}
      {command.isError ? (
        <p className="journey-inline-error" role="alert">
          {command.error.message}
        </p>
      ) : null}
    </div>
  );
}

function InlineError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="journey-inline-error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}
