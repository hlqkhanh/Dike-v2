"use client";

import type { RidePostResponse } from "@dike/api-client-ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Navigation, Play, Route } from "lucide-react";

import { rideApi } from "./api";

const steps = [
  { status: "ACCEPTED", label: "Đã xác nhận", icon: Check },
  { status: "DRIVER_STARTED", label: "Đang đến đón", icon: Play },
  { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón", icon: MapPin },
  { status: "COMPLETED", label: "Hoàn thành", icon: Navigation },
] as const;

type ProgressStatus = (typeof steps)[number]["status"];

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
        <strong>{steps[Math.max(0, activeIndex)]?.label}</strong>
      </header>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const complete = activeIndex >= index;
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
      {update.isError ? <p role="alert">{update.error.message}</p> : null}
    </section>
  );
}

export const isActiveResponse = (response: RidePostResponse) =>
  ["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
    response.status,
  );
