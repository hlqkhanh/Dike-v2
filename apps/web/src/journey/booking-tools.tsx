"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { journeyApi } from "./api";

export function BookingTools({
  bookingId,
  driver,
}: {
  bookingId: string;
  driver: boolean;
}) {
  const client = useQueryClient();
  const payment = useQuery({
    queryKey: ["payment", bookingId],
    queryFn: () => journeyApi.payment(bookingId),
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
    refetchInterval: 10000,
    retry: false,
  });
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
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
  const sharePosition = () =>
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
      () => undefined,
      { enableHighAccuracy: true },
    );
  return (
    <>
      <section className="settings-card">
        <h2>Xác nhận khoản đóng góp</h2>
        {payment.isPending ? (
          <p>Đang tải…</p>
        ) : payment.isError ? (
          <p role="alert">{payment.error.message}</p>
        ) : (
          <>
            <p>
              {payment.data.status} ·{" "}
              {new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(payment.data.amountVnd)}
            </p>
            <p>Dike không xác minh giao dịch ngân hàng.</p>
            <button
              disabled={
                command.isPending || (payment.data.locked && ownAcknowledged)
              }
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
              {ownAcknowledged
                ? "Rút xác nhận"
                : driver
                  ? "Tôi đã nhận"
                  : "Tôi đã trả"}
            </button>
            {payment.data.locked ? (
              <p role="status">Hai phía đã xác nhận; trạng thái đã khóa.</p>
            ) : null}
          </>
        )}
      </section>
      <section className="settings-card">
        <h2>Chia sẻ vị trí chuyến đi</h2>
        <div className="social-tabs">
          <button
            disabled={command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.locationConsent(bookingId, true))
            }
          >
            Bật chia sẻ
          </button>
          <button
            disabled={command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.locationConsent(bookingId, false))
            }
          >
            Tắt chia sẻ
          </button>
          <button disabled={command.isPending} onClick={sharePosition}>
            Gửi vị trí hiện tại
          </button>
        </div>
        {locations.data?.locations.map((location) => (
          <p key={location.userId}>
            Vị trí đối ứng: {location.latitude.toFixed(5)},{" "}
            {location.longitude.toFixed(5)} ·{" "}
            {location.stale ? "Đã cũ" : "Mới cập nhật"}
          </p>
        ))}
      </section>
      <section className="settings-card">
        <h2>Đánh giá chuyến đi</h2>
        {eligibility.data?.eligible ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              command.mutate(() =>
                journeyApi.submitReview(bookingId, stars, comment),
              );
            }}
          >
            <label>
              Số sao
              <select
                value={stars}
                onChange={(event) => setStars(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option value={value} key={value}>
                    {value} sao
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhận xét
              <textarea
                maxLength={1000}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <button disabled={command.isPending}>Gửi đánh giá</button>
          </form>
        ) : (
          <p>
            {eligibility.data?.submitted
              ? "Bạn đã gửi đánh giá."
              : "Chưa đủ điều kiện đánh giá."}
          </p>
        )}
        {reviews.data?.map((review) => (
          <article key={review.id}>
            <strong>
              {review.stars} sao · {review.reviewerDisplayName}
            </strong>
            <p>{review.comment}</p>
            <small>{review.publicationStatus}</small>
          </article>
        ))}
      </section>
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
    </>
  );
}
