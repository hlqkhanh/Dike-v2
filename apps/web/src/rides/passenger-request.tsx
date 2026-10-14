"use client";

import {
  ApiError,
  type PickupCheck,
  type RidePostView,
} from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, MapPin, Search, Send, X } from "lucide-react";
import { MemberAvatar } from "../../app/components/member-avatar";
import { authApi } from "../auth/api";
import { rideApi } from "./api";
import { routingApi } from "../routing/client";
import type { PlaceResponse, PlaceSuggestionResponse } from "../routing/api";

const RouteMap = dynamic(() => import("./post-route-map"), { ssr: false });
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export function PickupSummary({ check }: { check: PickupCheck }) {
  return (
    <div
      className={`pickup-summary ${check.compatible ? "is-compatible" : "is-incompatible"}`}
      role="status"
    >
      <strong>
        {check.compatible
          ? "Tiện đường"
          : check.reason === "PICKUP_TOO_LATE"
            ? "Không phù hợp giờ đón"
            : "Vượt mức ghé đón"}
      </strong>
      <span>Điểm đón: {check.pickup.displayLabel}</span>
      <span>Điểm đến chung: {check.destinationLabel}</span>
      <span>
        Phát sinh{" "}
        {new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
          check.extraMeters / 1000,
        )}{" "}
        km · {Math.ceil(check.extraSeconds / 60)} phút
      </span>
      <span>
        Giới hạn người chở: {check.maxExtraMeters / 1000} km ·{" "}
        {check.maxExtraSeconds / 60} phút
      </span>
      <span>
        Dự kiến đón {formatTime(check.pickupAt)} · đến nơi{" "}
        {formatTime(check.arrivalAt)}
      </span>
    </div>
  );
}

export function PassengerRequest({
  post,
  onClose,
  onSent,
}: {
  post: RidePostView;
  onClose: () => void;
  onSent?: () => void;
}) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<PlaceResponse>();
  const [message, setMessage] = useState("");
  const [check, setCheck] = useState<PickupCheck>();
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    enabled: false,
  });
  const baseRoute = useQuery({
    queryKey: ["feed", "route", post.id],
    queryFn: () => rideApi.postRoute(post.id),
    staleTime: 300000,
    retry: (count, error) =>
      error instanceof ApiError &&
      error.code === "POST_ROUTE_CALCULATING" &&
      count < 5,
    retryDelay: 3000,
  });
  const driver = useMemo(
    () => ({
      name: post.ownerDisplayName || "Người chở",
      avatarUrl: post.ownerAvatarUrl,
    }),
    [post.ownerDisplayName, post.ownerAvatarUrl],
  );
  const passenger = useMemo(
    () => ({
      name: session.data?.user?.displayName || "Bạn",
      avatarUrl: session.data?.user?.avatarUrl,
    }),
    [session.data?.user?.displayName, session.data?.user?.avatarUrl],
  );
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      previous?.focus();
    };
  }, []);
  const evaluate = useMutation({
    mutationFn: (value: { placeRef: string; generation: number }) =>
      rideApi.checkPickup(post.id, { pickupPlaceRef: value.placeRef }),
    onSuccess: (result, value) => {
      if (value.generation === generation.current) setCheck(result);
    },
  });
  const search = useMutation({
    mutationFn: async (query: string) => {
      const token = (await routingApi.createPlaceSession()).sessionToken;
      return {
        token,
        suggestions: await routingApi.autocompletePlaces(token, query),
        query,
      };
    },
  });
  const { mutate: searchPlaces } = search;
  const select = useMutation({
    mutationFn: (value: {
      suggestion: PlaceSuggestionResponse;
      token: string;
      generation: number;
    }) => routingApi.resolvePlace(value.token, value.suggestion.placeRef),
    onSuccess: (place, value) => {
      if (value.generation !== generation.current) return;
      setSelected(place);
      setText(place.displayLabel);
      setCheck(undefined);
      search.reset();
      evaluate.mutate({
        placeRef: place.placeRef,
        generation: value.generation,
      });
    },
  });
  const send = useMutation({
    mutationFn: () => rideApi.createPostResponse(post.id, message, check?.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      onSent?.();
      onClose();
    },
  });
  function editAddress(value: string) {
    generation.current++;
    setText(value);
    setSelected(undefined);
    setCheck(undefined);
    evaluate.reset();
    send.reset();
  }
  const fresh =
    check &&
    check.postVersion === post.version &&
    new Date(check.expiresAt).getTime() > now;
  const suggestions =
    !selected && search.data?.query === text.trim()
      ? search.data.suggestions
      : [];
  const route = useMemo(
    () =>
      check
        ? {
            geometry: check.geometry,
            distanceMeters: 0,
            durationSeconds: 0,
            provider: check.provider,
          }
        : baseRoute.data,
    [check, baseRoute.data],
  );
  const error = send.error ?? evaluate.error ?? select.error ?? search.error;
  const busy = select.isPending || evaluate.isPending;
  return (
    <div
      className="home-response-modal passenger-modal"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !send.isPending) onClose();
      }}
    >
      <section
        className="passenger-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-request-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !send.isPending) onClose();
          if (event.key === "Tab") {
            const nodes = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]',
              ),
            ].filter((node) => node.offsetParent !== null);
            const first = nodes[0],
              last = nodes.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button
          className="passenger-close"
          type="button"
          aria-label="Đóng"
          disabled={send.isPending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="passenger-content">
          <div className="passenger-heading">
            <span className="passenger-eyebrow">CÙNG CHUNG ĐIỂM ĐẾN</span>
            <h2 id="pickup-request-title">Đi ké cùng {driver.name}</h2>
            <p>Chọn nơi đón, phần còn lại để Diké tìm đường.</p>
          </div>
          <div className="passenger-driver">
            <MemberAvatar
              name={driver.name}
              avatarUrl={driver.avatarUrl}
              className="passenger-avatar"
              size={40}
            />
            <div>
              <strong>{driver.name}</strong>
              <span>
                <Clock3 size={14} />
                Khởi hành {formatTime(post.departureAt)}
              </span>
            </div>
          </div>
          <div className="passenger-fields">
            <label htmlFor="pickup-address">Điểm đón của bạn</label>
            <div
              className={`passenger-address ${selected ? "is-selected" : ""}`}
            >
              <MapPin size={20} />
              <input
                ref={input}
                id="pickup-address"
                value={text}
                maxLength={250}
                placeholder="Bạn muốn được đón ở đâu?"
                disabled={send.isPending}
                autoComplete="off"
                onChange={(e) => editAddress(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (
                      text.trim().length >= 3 &&
                      !selected &&
                      !search.isPending &&
                      !send.isPending &&
                      !event.nativeEvent.isComposing
                    )
                      searchPlaces(text.trim());
                  }
                }}
              />
              {selected ? (
                <button
                  type="button"
                  aria-label="Đổi điểm đón"
                  disabled={send.isPending}
                  onClick={() => {
                    editAddress("");
                    input.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  className="passenger-search-button"
                  type="button"
                  aria-label="Tìm địa điểm"
                  title="Tìm địa điểm (Enter)"
                  disabled={
                    text.trim().length < 3 || search.isPending || send.isPending
                  }
                  onClick={() => searchPlaces(text.trim())}
                >
                  <Search size={18} />
                </button>
              )}
            </div>
            {suggestions.length > 0 && (
              <ul className="passenger-suggestions">
                {suggestions.map((item) => (
                  <li key={item.placeRef}>
                    <button
                      type="button"
                      disabled={select.isPending || send.isPending}
                      onClick={() =>
                        select.mutate({
                          suggestion: item,
                          token: search.data!.token,
                          generation: generation.current,
                        })
                      }
                    >
                      <MapPin size={16} />
                      <span>{item.displayLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!selected && search.isPending && (
              <span className="passenger-hint" role="status">
                Đang tìm địa điểm…
              </span>
            )}
            {!selected &&
              search.isSuccess &&
              search.data.query === text.trim() &&
              !suggestions.length && (
                <span className="passenger-hint">
                  Chưa tìm thấy địa điểm. Thử nhập địa chỉ cụ thể hơn.
                </span>
              )}
            {busy && (
              <div className="passenger-match is-loading" role="status">
                <span className="passenger-loading-dot" />
                Đang tìm tuyến ghé đón phù hợp…
              </div>
            )}
            {check && !busy && (
              <div
                className={`passenger-match ${check.compatible ? "is-compatible" : "is-incompatible"}`}
                role="status"
              >
                <Check size={18} />
                <div>
                  <strong>
                    {check.compatible
                      ? "Tiện đường"
                      : check.reason === "PICKUP_TOO_LATE"
                        ? "Chưa phù hợp giờ đón"
                        : "Điểm đón vượt mức ghé đón"}
                  </strong>
                  <span>
                    Thêm{" "}
                    {new Intl.NumberFormat("vi-VN", {
                      maximumFractionDigits: 1,
                    }).format(check.extraMeters / 1000)}{" "}
                    km · {Math.ceil(check.extraSeconds / 60)} phút
                    {check.compatible
                      ? ` · Đón khoảng ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(check.pickupAt))}`
                      : ""}
                  </span>
                </div>
              </div>
            )}
            <label className="passenger-message" htmlFor="pickup-message">
              Lời nhắn <span>Không bắt buộc</span>
            </label>
            <textarea
              id="pickup-message"
              maxLength={300}
              value={message}
              disabled={send.isPending}
              placeholder="Ví dụ: Mình đợi ở cổng chính nhé."
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="passenger-message-count">
              {message.length}/300
            </span>
            {error && (
              <p className="passenger-error" role="alert">
                {error.message}
                {selected && !send.isPending && !busy && (
                  <button
                    type="button"
                    onClick={() =>
                      evaluate.mutate({
                        placeRef: selected.placeRef,
                        generation: generation.current,
                      })
                    }
                  >
                    Thử lại
                  </button>
                )}
              </p>
            )}
            {check && !fresh && (
              <p className="passenger-hint" role="status">
                Kết quả cần cập nhật.
                <button
                  type="button"
                  disabled={busy || send.isPending}
                  onClick={() => {
                    if (selected)
                      evaluate.mutate({
                        placeRef: selected.placeRef,
                        generation: generation.current,
                      });
                  }}
                >
                  Kiểm tra lại
                </button>
              </p>
            )}
            {check?.provider === "FAKE" && (
              <span className="passenger-hint">
                Tuyến đường mô phỏng của bản demo.
              </span>
            )}
          </div>
          <div className="passenger-footer">
            <p>Người chở sẽ xác nhận yêu cầu của bạn.</p>
            <button
              className="passenger-submit"
              type="button"
              disabled={!check?.compatible || !fresh || busy || send.isPending}
              onClick={() => send.mutate()}
            >
              <Send size={18} />
              {send.isPending ? "Đang gửi…" : "Gửi yêu cầu đi ké"}
            </button>
          </div>
        </div>
        <aside
          className="passenger-map-panel"
          aria-label="Xem trước tuyến đi ké"
        >
          <div className="passenger-map-heading">
            <span>TUYẾN ĐƯỜNG CỦA BẠN</span>
            <strong>
              <MapPin size={16} />
              {post.destinationLabel}
            </strong>
          </div>
          {route ? (
            <RouteMap
              route={route}
              origin={post.originLabel}
              destination={post.destinationLabel}
              pickup={check?.pickup ?? selected}
              pickupIndex={check?.pickupIndex}
              driver={driver}
              passenger={passenger}
            />
          ) : (
            <div className="passenger-map-placeholder" role="status">
              <MapPin size={30} />
              <span>
                {baseRoute.isError
                  ? "Chưa tải được bản đồ tuyến đường."
                  : "Đang mở bản đồ…"}
              </span>
              {baseRoute.isError && (
                <button type="button" onClick={() => void baseRoute.refetch()}>
                  Thử lại
                </button>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
