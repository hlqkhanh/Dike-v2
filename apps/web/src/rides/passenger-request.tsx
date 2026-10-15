"use client";

import {
  ApiError,
  type PickupCheck,
  type RidePostView,
} from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Info,
  MapPin,
  Route,
  Search,
  Send,
  X,
} from "lucide-react";
import { MemberAvatar } from "../../app/components/member-avatar";
import { authApi } from "../auth/api";
import { rideApi } from "./api";
import { routingApi } from "../routing/client";
import type {
  PlaceSuggestionResponse,
  RoutePlace,
  RouteResponse,
} from "../routing/api";

const RouteMap = dynamic(() => import("./post-route-map"), { ssr: false });
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));

export function PickupSummary({
  check,
  originLabel = "Điểm khởi hành",
  driver,
  passenger,
}: {
  check: PickupCheck;
  originLabel?: string;
  driver?: { name: string; avatarUrl?: string | null };
  passenger?: { name: string; avatarUrl?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const extraDistance = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(check.extraMeters / 1000);
  const extraMinutes = Math.ceil(check.extraSeconds / 60);
  const title = check.compatible
    ? "Tiện đường"
    : check.reason === "PICKUP_TOO_LATE"
      ? "Không phù hợp giờ đón"
      : "Vượt mức ghé đón";
  const expired = new Date(check.expiresAt).getTime() <= renderedAt;
  const savedRoute = useMemo(
    () => ({
      geometry: check.geometry,
      distanceMeters: 0,
      durationSeconds: 0,
      provider: check.provider,
    }),
    [check.geometry, check.provider],
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        className={`pickup-summary ${check.compatible ? "is-compatible" : "is-incompatible"}`}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <MapPin size={25} aria-hidden="true" />
        <span className="pickup-summary-copy">
          <span className="pickup-summary-title">
            <strong>{title}</strong>
            <small>
              +{extraDistance} km · {extraMinutes} phút
            </small>
          </span>
          <span className="pickup-summary-address">
            <Flag size={15} aria-hidden="true" />
            Đón: {check.pickup.displayLabel}
          </span>
          <span className="pickup-summary-address">
            <Flag size={15} aria-hidden="true" />
            Đến: {check.destinationLabel}
          </span>
        </span>
        <ChevronRight
          className="pickup-summary-chevron"
          size={20}
          aria-hidden="true"
        />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pickup-detail-modal"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="pickup-detail-title"
              >
                <button
                  className="pickup-detail-close"
                  type="button"
                  aria-label="Đóng chi tiết tiện đường"
                  onClick={() => setOpen(false)}
                >
                  <X size={24} aria-hidden="true" />
                </button>
                <h2 id="pickup-detail-title">Chi tiết tiện đường</h2>
                <p>
                  Thông tin chi tiết về lộ trình và điểm đón/trả của người đi
                  ké.
                </p>
                <div className="pickup-detail-content">
                  <div className="pickup-detail-map">
                    {check.geometry.length >= 2 ? (
                      <RouteMap
                        route={savedRoute}
                        origin={originLabel}
                        destination={
                          check.driverDestinationLabel ?? check.destinationLabel
                        }
                        pickup={check.pickup}
                        pickupIndex={check.pickupIndex}
                        dropoff={check.dropoff}
                        dropoffIndex={check.dropoffIndex}
                        driver={driver}
                        passenger={passenger}
                      />
                    ) : (
                      <div className="pickup-detail-map-fallback" role="status">
                        Tuyến đường cũ chưa có dữ liệu bản đồ được lưu.
                      </div>
                    )}
                    <div className="pickup-detail-detour">
                      <strong>Phát sinh +{extraDistance} km</strong>
                      <span>Thêm khoảng {extraMinutes} phút</span>
                    </div>
                  </div>
                  <div className="pickup-detail-information">
                    <div className="pickup-detail-list">
                      <div>
                        <MapPin aria-hidden="true" />
                        <span>
                          <strong>Điểm đón</strong>
                          {check.pickup.displayLabel}
                        </span>
                      </div>
                      <div>
                        <Flag aria-hidden="true" />
                        <span>
                          <strong>Điểm đến của bạn</strong>
                          {check.destinationLabel}
                        </span>
                      </div>
                      <div>
                        <Route aria-hidden="true" />
                        <span>
                          <strong>Giới hạn người chở</strong>
                          {check.maxExtraMeters / 1000} km ·{" "}
                          {check.maxExtraSeconds / 60} phút
                        </span>
                      </div>
                      <div>
                        <Clock3 aria-hidden="true" />
                        <span>
                          <strong>Dự kiến đón</strong>
                          {formatTime(check.pickupAt)}
                        </span>
                      </div>
                      <div>
                        <Flag aria-hidden="true" />
                        <span>
                          <strong>Dự kiến tới nơi</strong>
                          {formatTime(check.arrivalAt)}
                        </span>
                      </div>
                    </div>
                    <div className="pickup-detail-note">
                      <Info size={20} aria-hidden="true" />
                      <span>
                        {expired
                          ? "Kiểm tra điểm đón đã hết hạn. Người đi ké cần kiểm tra lại để bạn xác nhận."
                          : `Kiểm tra điểm đón có hiệu lực đến ${formatTime(check.expiresAt)}.`}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type RequestPlace = RoutePlace & { placeRef?: string };

function RequestAddress({
  id,
  label,
  placeholder,
  value,
  selected,
  disabled,
  onEdit,
  onSelect,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  selected?: RequestPlace;
  disabled: boolean;
  onEdit: (value: string) => void;
  onSelect: (place: RequestPlace) => void;
}) {
  const revision = useRef(0);
  const search = useMutation({
    mutationFn: async (query: string) => {
      const token = (await routingApi.createPlaceSession()).sessionToken;
      return {
        token,
        query,
        suggestions: await routingApi.autocompletePlaces(token, query),
      };
    },
  });
  const select = useMutation({
    mutationFn: (value: {
      suggestion: PlaceSuggestionResponse;
      token: string;
      revision: number;
    }) => routingApi.resolvePlace(value.token, value.suggestion.placeRef),
    onSuccess: (place, request) => {
      if (request.revision !== revision.current) return;
      onSelect(place);
      search.reset();
    },
  });
  const suggestions =
    !selected && search.data?.query === value.trim()
      ? search.data.suggestions
      : [];
  const canSearch =
    value.trim().length >= 3 && !selected && !search.isPending && !disabled;
  function edit(text: string) {
    revision.current++;
    select.reset();
    search.reset();
    onEdit(text);
  }
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className={`passenger-address ${selected ? "is-selected" : ""}`}>
        {id === "pickup-address" ? <MapPin size={20} /> : <Flag size={20} />}
        <input
          id={id}
          value={value}
          maxLength={250}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => edit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSearch) search.mutate(value.trim());
            }
          }}
        />
        {selected ? (
          <button
            type="button"
            aria-label={
              id === "pickup-address" ? "Đổi điểm đón" : "Đổi điểm đến"
            }
            disabled={disabled}
            onClick={() => edit("")}
          >
            <X size={16} />
          </button>
        ) : (
          <button
            className="passenger-search-button"
            type="button"
            aria-label={
              id === "pickup-address" ? "Tìm địa điểm" : "Tìm điểm đến"
            }
            title="Tìm địa điểm (Enter)"
            disabled={!canSearch}
            onClick={() => search.mutate(value.trim())}
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
                disabled={select.isPending || disabled}
                onClick={() =>
                  select.mutate({
                    suggestion: item,
                    token: search.data!.token,
                    revision: revision.current,
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
      {search.isPending && (
        <span className="passenger-hint" role="status">
          Đang tìm địa điểm…
        </span>
      )}
      {!selected &&
        search.isSuccess &&
        search.data.query === value.trim() &&
        !suggestions.length && (
          <span className="passenger-hint">
            Chưa tìm thấy địa điểm. Thử nhập địa chỉ cụ thể hơn.
          </span>
        )}
      {(search.error || select.error) && (
        <p className="passenger-error" role="alert">
          {(select.error ?? search.error)?.message}
        </p>
      )}
    </>
  );
}

export function PassengerRequest({
  post,
  onClose,
  onSent,
  initialJourney,
  initialMessage = "",
}: {
  post: RidePostView;
  onClose: () => void;
  onSent?: () => void;
  initialJourney?: RouteResponse;
  initialMessage?: string;
}) {
  const client = useQueryClient();
  const [text, setText] = useState(initialJourney?.origin.displayLabel ?? "");
  const [selected, setSelected] = useState<
    (RoutePlace & { placeRef?: string }) | undefined
  >(
    initialJourney
      ? { ...initialJourney.origin, placeRef: undefined }
      : undefined,
  );
  const [message, setMessage] = useState(initialMessage.slice(0, 300));
  const [check, setCheck] = useState<PickupCheck>();
  const [now, setNow] = useState(() => Date.now());
  const generation = useRef(0);
  const [destinationText, setDestinationText] = useState(
    initialJourney?.destination.displayLabel ?? "",
  );
  const [destinationSelected, setDestinationSelected] = useState<
    RequestPlace | undefined
  >(
    initialJourney
      ? { ...initialJourney.destination, placeRef: undefined }
      : undefined,
  );
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
    document.getElementById("pickup-address")?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      previous?.focus();
    };
  }, []);
  const evaluate = useMutation({
    mutationFn: (value: {
      generation: number;
      pickup?: RequestPlace;
      dropoff?: RequestPlace;
    }) =>
      rideApi.checkPickup(post.id, {
        pickupPlaceRef: value.pickup?.placeRef,
        dropoffPlaceRef: value.dropoff?.placeRef,
        passengerRouteId: initialJourney?.id,
        ...(initialJourney && !value.pickup ? { useDriverPickup: true } : {}),
        ...(initialJourney && !value.dropoff ? { useDriverDropoff: true } : {}),
      }),
    onSuccess: (result, value) => {
      if (value.generation === generation.current) setCheck(result);
    },
  });
  const sameRoute = !text.trim() && !destinationText.trim();
  const addressesReady =
    (!text.trim() || !!selected) &&
    (!destinationText.trim() || !!destinationSelected);
  const { mutate: evaluatePickup } = evaluate;
  useEffect(() => {
    if (!addressesReady || sameRoute) return;
    const timer = window.setTimeout(
      () =>
        evaluatePickup({
          generation: generation.current,
          pickup: selected,
          dropoff: destinationSelected,
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [
    addressesReady,
    sameRoute,
    selected,
    destinationSelected,
    evaluatePickup,
  ]);
  const send = useMutation({
    mutationFn: () =>
      rideApi.createPostResponse(
        post.id,
        message,
        sameRoute ? undefined : check?.id,
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      onSent?.();
      onClose();
    },
  });
  function invalidateAddress() {
    generation.current++;
    setCheck(undefined);
    evaluate.reset();
    send.reset();
  }
  function retryCheck() {
    if (addressesReady)
      evaluate.mutate({
        generation: generation.current,
        pickup: selected,
        dropoff: destinationSelected,
      });
  }
  const fresh =
    check &&
    check.postVersion === post.version &&
    new Date(check.expiresAt).getTime() > now;
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
  const error = send.error ?? evaluate.error;
  const busy = evaluate.isPending;
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
          <div className="passenger-scroll">
            <div className="passenger-heading">
              <span className="passenger-eyebrow">ĐỒNG HÀNH CÙNG NHAU</span>
              <h2 id="pickup-request-title">Đi ké cùng {driver.name}</h2>
              <p>
                Để trống địa chỉ để đi cùng điểm đón hoặc điểm đến của người
                chở.
              </p>
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
              <RequestAddress
                id="pickup-address"
                label="Điểm đón của bạn"
                placeholder={post.originLabel}
                value={text}
                selected={selected}
                disabled={send.isPending}
                onEdit={(value) => {
                  invalidateAddress();
                  setText(value);
                  setSelected(undefined);
                }}
                onSelect={(place) => {
                  invalidateAddress();
                  setText(place.displayLabel);
                  setSelected(place);
                }}
              />
              <RequestAddress
                id="pickup-destination"
                label="Điểm đến của bạn"
                placeholder={post.destinationLabel}
                value={destinationText}
                selected={destinationSelected}
                disabled={send.isPending}
                onEdit={(value) => {
                  invalidateAddress();
                  setDestinationText(value);
                  setDestinationSelected(undefined);
                }}
                onSelect={(place) => {
                  invalidateAddress();
                  setDestinationText(place.displayLabel);
                  setDestinationSelected(place);
                }}
              />
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
                  {addressesReady && !send.isPending && !busy && (
                    <button type="button" onClick={retryCheck}>
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
                    disabled={busy || send.isPending || !addressesReady}
                    onClick={retryCheck}
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
          </div>
          <div className="passenger-footer">
            <p>Người chở sẽ xác nhận yêu cầu của bạn.</p>
            <button
              className="passenger-submit"
              type="button"
              disabled={
                !addressesReady ||
                (!sameRoute && (!check?.compatible || !fresh || busy)) ||
                send.isPending
              }
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
              {check?.destinationLabel ??
                destinationSelected?.displayLabel ??
                post.destinationLabel}
            </strong>
          </div>
          {route ? (
            <RouteMap
              route={route}
              origin={post.originLabel}
              destination={post.destinationLabel}
              pickup={check?.pickup ?? selected}
              pickupIndex={check?.pickupIndex}
              dropoff={check?.dropoff ?? destinationSelected}
              dropoffIndex={check?.dropoffIndex}
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
