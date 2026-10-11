"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleDollarSign,
  Clock3,
  LocateFixed,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useState } from "react";
import { journeyApi } from "./api";

const paymentNames: Record<string, string> = {
  PENDING: "Chờ xác nhận",
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
      client.invalidateQueries({ queryKey: ["review-eligibility", bookingId] }),
      client.invalidateQueries({ queryKey: ["booking-reviews", bookingId] }),
      client.invalidateQueries({ queryKey: ["live-location", bookingId] }),
    ]);
  };
  const command = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const ownKind = driver ? "received" : "paid";
  const ownAcknowledged = driver
    ? Boolean(payment.data?.driverReceivedAt)
    : Boolean(payment.data?.passengerPaidAt);

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
              className={`journey-state-pill${payment.data.locked ? " is-success" : ""}`}
            >
              {paymentNames[payment.data.status] ?? "Đang xử lý"}
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
            <div className="journey-confirmation-grid">
              <div
                className={payment.data.passengerPaidAt ? "is-complete" : ""}
              >
                <Check aria-hidden="true" size={17} />
                <span>
                  <strong>Hành khách</strong>
                  <small>{timeLabel(payment.data.passengerPaidAt)}</small>
                </span>
              </div>
              <div
                className={payment.data.driverReceivedAt ? "is-complete" : ""}
              >
                <Check aria-hidden="true" size={17} />
                <span>
                  <strong>Tài xế</strong>
                  <small>{timeLabel(payment.data.driverReceivedAt)}</small>
                </span>
              </div>
            </div>
            <p className="journey-section-copy">
              Diké chỉ ghi nhận xác nhận của hai bên và không xác minh giao dịch
              ngân hàng.
            </p>
            <button
              className="app-button app-button--primary"
              type="button"
              disabled={command.isPending || payment.data.locked}
              onClick={() =>
                command.mutate(() =>
                  journeyApi.acknowledgePayment(
                    bookingId,
                    ownKind,
                    !ownAcknowledged,
                  ),
                )
              }
            >
              {payment.data.locked
                ? "Hai bên đã xác nhận"
                : ownAcknowledged
                  ? "Rút xác nhận"
                  : driver
                    ? "Xác nhận đã nhận tiền"
                    : "Xác nhận đã thanh toán"}
            </button>
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
