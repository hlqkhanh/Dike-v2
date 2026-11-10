"use client";

import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bike,
  CalendarClock,
  CarFront,
  Check,
  Clock3,
  Coins,
  MapPin,
  Minus,
  Plus,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RidePostView, TripView } from "@dike/api-client-ts";
import { authApi } from "../../../src/auth/api";
import { readAssistantRideDraft } from "../../../src/assistant/ride-draft";
import { routingApi } from "../../../src/routing/client";
import { rideApi } from "../../../src/rides/api";
import { PassengerRequest } from "../../../src/rides/passenger-request";
import { MemberAvatar } from "../../components/member-avatar";
import type {
  ContributionEstimate,
  PlaceResponse,
  PlaceSuggestionResponse,
  RouteResponse,
  VehicleMode,
} from "../../../src/routing/api";
import { ErrorState, LoadingState } from "../../components/app-ui";

const RouteMap = dynamic(() => import("../../../src/rides/post-route-map"), {
  ssr: false,
  loading: () => <LoadingState label="Đang tải bản đồ" />,
});
type Picker = {
  query: string;
  sessionToken?: string;
  suggestions: PlaceSuggestionResponse[];
  selected?: PlaceResponse;
  loading: boolean;
  searched: boolean;
};
const emptyPicker = (): Picker => ({
  query: "",
  suggestions: [],
  loading: false,
  searched: false,
});
type Publication = {
  key: string;
  departure: string;
  source?: { id: string; version: number };
  trip?: TripView;
  post?: RidePostView;
  opened?: boolean;
};
const dateLocal = (value: number) =>
  new Date(value - new Date(value).getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const dateLabel = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
const distance = (value: number) =>
  value < 1000
    ? `${Math.round(value)} m`
    : `${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
const money = (value: number) =>
  value.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Chưa thể xử lý. Vui lòng thử lại.";

export function UnifiedRideFlow({
  initialMode,
  initialRouteId,
  initialAssistantDraftId,
}: {
  initialMode: "driver" | "passenger";
  initialRouteId?: string;
  initialAssistantDraftId?: string;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [mode, setMode] = useState(initialMode);
  const [origin, setOrigin] = useState<Picker>(emptyPicker);
  const [destination, setDestination] = useState<Picker>(emptyPicker);
  const [chosenVehicleMode, setVehicleMode] =
    useState<VehicleMode>("MOTORBIKE");
  const [seats, setSeats] = useState(1);
  const [departure, setDeparture] = useState("");
  const [immediate, setImmediate] = useState(true);
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [calculatedRoute, setRoute] = useState<RouteResponse>();
  const [calculatedEstimate, setEstimate] = useState<ContributionEstimate>();
  const [ignoreInitialRoute, setIgnoreInitialRoute] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();
  const [stage, setStage] = useState<"edit" | "matches">("edit");
  const [mapLayer, setMapLayer] = useState<"map" | "satellite">("map");
  const [responsePost, setResponsePost] = useState<RidePostView>();
  const [responseMessage, setResponseMessage] = useState("");
  const [sent, setSent] = useState<string>();
  const [sentPostIds, setSentPostIds] = useState<Set<string>>(() => new Set());
  const [publishingStarted, setPublishingStarted] = useState(false);
  const generation = useRef({ origin: 0, destination: 0, route: 0 });
  const publication = useRef<Publication | undefined>(undefined);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const userId = client.getQueryData<
        Awaited<ReturnType<typeof authApi.session>>
      >(["auth", "session"])?.user?.id;
      const imported =
        userId && initialAssistantDraftId
          ? readAssistantRideDraft(client, userId, initialAssistantDraftId)
          : undefined;
      if (
        initialAssistantDraftId &&
        (!imported || Date.now() - imported.createdAt > 30 * 60 * 1000)
      ) {
        setError(
          "Bản nháp từ trợ lý đã hết hạn. Mở chatbot và bấm tiếp tục lại để điền thông tin.",
        );
      }
      if (imported && Date.now() - imported.createdAt <= 30 * 60 * 1000) {
        setOrigin({
          ...emptyPicker(),
          query:
            imported.origin?.displayLabel ?? imported.fields.originQuery ?? "",
          selected: imported.origin,
        });
        setDestination({
          ...emptyPicker(),
          query:
            imported.destination?.displayLabel ??
            imported.fields.destinationQuery ??
            "",
          selected: imported.destination,
        });
        setSeats(Math.max(1, Math.min(8, Number(imported.fields.seats) || 1)));
        setMode(imported.fields.role === "DRIVER" ? "driver" : "passenger");
        setImmediate(false);
        setDeparture(
          imported.fields.date && imported.fields.departureTime
            ? `${imported.fields.date}T${imported.fields.departureTime}`
            : "",
        );
      } else setDeparture(dateLocal(Date.now()));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [client, initialAssistantDraftId]);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    enabled: false,
  });
  const capabilities = useQuery({
    queryKey: ["rides", "capabilities"],
    queryFn: rideApi.capabilities,
  });
  const importedRoute = useQuery({
    queryKey: ["routing", "route", initialRouteId],
    queryFn: () => routingApi.getRoute(initialRouteId!),
    enabled: Boolean(initialRouteId) && !ignoreInitialRoute,
    retry: false,
  });
  const route =
    calculatedRoute ?? (!ignoreInitialRoute ? importedRoute.data : undefined);
  const vehicleMode =
    !ignoreInitialRoute && importedRoute.data
      ? importedRoute.data.vehicleMode
      : chosenVehicleMode;
  const importedEstimate = useQuery({
    queryKey: ["routing", "compose-estimate", initialRouteId],
    queryFn: () =>
      routingApi.createEstimate(
        importedRoute.data!.id,
        importedRoute.data!.distanceMeters,
        1,
      ),
    enabled: Boolean(importedRoute.data) && !ignoreInitialRoute,
    retry: false,
  });
  const estimate =
    calculatedEstimate ??
    (!ignoreInitialRoute ? importedEstimate.data : undefined);
  const member = useMemo(
    () => ({
      name: session.data?.user?.displayName || "Bạn",
      avatarUrl: session.data?.user?.avatarUrl,
    }),
    [session.data?.user?.displayName, session.data?.user?.avatarUrl],
  );
  const vehicle = capabilities.data?.vehicles.find(
    (v) => v.type === (vehicleMode === "MOTORBIKE" ? "MOTORCYCLE" : "CAR"),
  );
  const maxSeats =
    vehicleMode === "MOTORBIKE"
      ? 1
      : Math.min(8, vehicle?.passengerCapacity ?? 4);
  const effectiveSeats = Math.min(seats, maxSeats);
  const discovery = useMutation({ mutationFn: rideApi.discover });
  const discover = discovery.mutate;
  useEffect(() => {
    if (!initialAssistantDraftId) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const userId = client.getQueryData<
        Awaited<ReturnType<typeof authApi.session>>
      >(["auth", "session"])?.user?.id;
      const imported = userId
        ? readAssistantRideDraft(client, userId, initialAssistantDraftId)
        : undefined;
      if (!imported || Date.now() - imported.createdAt > 30 * 60 * 1000) return;
      if (!imported.origin || !imported.destination) {
        setError(
          "Chọn hai địa chỉ chính xác để tiếp tục tới bước tìm bài phù hợp.",
        );
        return;
      }
      setPlanning(true);
      try {
        const time = new Date(
          `${imported.fields.date}T${imported.fields.departureTime}`,
        ).getTime();
        if (
          !Number.isFinite(time) ||
          time <= Date.now() ||
          time > Date.now() + 7 * 86400000
        )
          throw new Error(
            "Chọn giờ khởi hành trong tương lai, trong vòng 7 ngày tới.",
          );
        const next =
          imported.route &&
          new Date(imported.route.expiresAt).getTime() > Date.now()
            ? imported.route
            : await routingApi.createRoute(
                imported.origin.placeRef,
                imported.destination.placeRef,
                imported.route?.vehicleMode ?? "MOTORBIKE",
              );
        if (cancelled) return;
        setRoute(next);
        setVehicleMode(next.vehicleMode);
        setEstimate(imported.estimate);
        setStage("matches");
        discover({
          routeId: next.id,
          role: imported.fields.role === "DRIVER" ? "driver" : "passenger",
          departureAt: new Date(
            `${imported.fields.date}T${imported.fields.departureTime}`,
          ).toISOString(),
          seats: Number(imported.fields.seats || "1"),
        });
      } catch (cause) {
        if (!cancelled) setError(messageOf(cause));
      } finally {
        if (!cancelled) setPlanning(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, initialAssistantDraftId, discover]);
  const offer = useMutation({
    mutationFn: () =>
      rideApi.createPostResponse(responsePost!.id, responseMessage),
    onSuccess: () => {
      const postId = responsePost!.id;
      setSentPostIds((current) => new Set(current).add(postId));
      setSent("Đã gửi đề nghị chở. Bài đang soạn của bạn chưa được đăng.");
      setResponsePost(undefined);
    },
  });
  const publish = useMutation({
    mutationFn: async () => {
      if (!route) throw new Error("Hãy tính tuyến đường trước khi đăng bài.");
      if (
        new Date(route.expiresAt).getTime() <= Date.now() &&
        !publication.current
      )
        throw new Error("Tuyến đường đã hết hạn. Quay lại để tính tuyến mới.");
      const visibility = audience === "DRAFT" ? "PUBLIC" : audience;
      if (!publication.current) {
        const time = immediate
          ? Date.now() + 120000
          : new Date(departure).getTime();
        if (!Number.isFinite(time) || time <= Date.now())
          throw new Error("Vui lòng chọn giờ khởi hành trong tương lai.");
        if (
          mode === "driver" &&
          (!capabilities.data?.canCreateTrip || !vehicle)
        )
          throw new Error(
            "Chưa có phương tiện đã duyệt phù hợp. Bạn có thể cập nhật trong trang cá nhân.",
          );
        publication.current = {
          key: crypto.randomUUID(),
          departure: new Date(time).toISOString(),
        };
        setPublishingStarted(true);
      }
      const progress = publication.current;
      if (mode === "driver") {
        progress.trip ??= await rideApi.createTrip(
          {
            vehicleId: vehicle!.id,
            routeId: route.id,
            departureAt: progress.departure,
            originLabel: route.origin.publicAreaLabel,
            destinationLabel: route.destination.publicAreaLabel,
            offeredSeats: effectiveSeats,
            contributionPerKm: estimate?.suggestedPerKmVnd ?? 1000,
            detourMeters: 1000,
            detourSeconds: 300,
            visibility,
            communityId: "",
          },
          progress.key,
        );
        progress.source = {
          id: progress.trip.id,
          version: progress.trip.version,
        };
      } else {
        progress.source ??= await rideApi.createSource(
          {
            routeId: route.id,
            departureAt: progress.departure,
            arrivalAt: new Date(
              new Date(progress.departure).getTime() +
                (Math.max(60, route.durationSeconds) + 3600) * 1000,
            ).toISOString(),
          },
          progress.key,
        );
      }
      progress.post ??= await rideApi.createPost(
        {
          type: mode === "driver" ? "OFFER_RIDE" : "NEED_RIDE",
          sourceId: progress.source.id,
          sourceVersion: progress.source.version,
          visibility,
          note,
        },
        progress.key,
      );
      if (audience !== "DRAFT") {
        if (mode === "driver") {
          if (!progress.opened) {
            await rideApi.openTrip(
              progress.trip!.id,
              progress.trip!.version,
              progress.key,
            );
            progress.opened = true;
          }
        } else
          progress.post = await rideApi.postAction(
            progress.post.id,
            "publish",
            progress.post.version,
            progress.key,
          );
      }
      return progress.post;
    },
    onSuccess: (post) => {
      void client.invalidateQueries({ queryKey: ["feed"] });
      void client.invalidateQueries({ queryKey: ["rides"] });
      router.push(`/feed/${encodeURIComponent(post.id)}`);
    },
    onError: () => {
      const progress = publication.current;
      if (progress && !progress.source && !progress.trip && !progress.post) {
        publication.current = undefined;
        setPublishingStarted(false);
      }
    },
  });
  function clearRoute() {
    setVehicleMode(vehicleMode);
    setIgnoreInitialRoute(true);
    generation.current.route++;
    setRoute(undefined);
    setEstimate(undefined);
    setError(undefined);
  }
  function updatePicker(field: "origin" | "destination", next: Picker) {
    generation.current[field]++;
    clearRoute();
    (field === "origin" ? setOrigin : setDestination)(next);
  }
  function choose(next: "driver" | "passenger") {
    if (publishingStarted || planning) return;
    setMode(next);
    setStage("edit");
    discovery.reset();
    setSent(undefined);
    router.replace(`/rides/new?mode=${next}`, { scroll: false });
  }
  async function search(field: "origin" | "destination") {
    const current = field === "origin" ? origin : destination;
    if (current.loading) return;
    const query = current.query.trim();
    if (query.length < 3)
      return setError("Nhập ít nhất 3 ký tự để tìm địa điểm.");
    const update = field === "origin" ? setOrigin : setDestination;
    const token = ++generation.current[field];
    clearRoute();
    update({ ...current, loading: true, searched: true, selected: undefined });
    try {
      const session = await routingApi.createPlaceSession();
      const suggestions = await routingApi.autocompletePlaces(
        session.sessionToken,
        query,
      );
      if (token === generation.current[field])
        update({
          query,
          sessionToken: session.sessionToken,
          suggestions,
          loading: false,
          searched: true,
        });
    } catch (cause) {
      if (token === generation.current[field]) {
        update({ ...current, loading: false });
        setError(messageOf(cause));
      }
    }
  }
  async function select(
    field: "origin" | "destination",
    suggestion: PlaceSuggestionResponse,
  ) {
    const current = field === "origin" ? origin : destination;
    if (!current.sessionToken || current.loading) return;
    const token = ++generation.current[field];
    const update = field === "origin" ? setOrigin : setDestination;
    update({ ...current, loading: true });
    try {
      const selected = await routingApi.resolvePlace(
        current.sessionToken,
        suggestion.placeRef,
      );
      if (token === generation.current[field]) {
        clearRoute();
        update({
          query: selected.displayLabel,
          selected,
          loading: false,
          searched: true,
          suggestions: [],
        });
      }
    } catch (cause) {
      if (token === generation.current[field]) {
        update({ ...current, loading: false });
        setError(messageOf(cause));
      }
    }
  }
  function searchTime() {
    const time = immediate ? Date.now() : new Date(departure).getTime();
    if (
      !Number.isFinite(time) ||
      (!immediate && time <= Date.now()) ||
      time > Date.now() + 7 * 86400000
    )
      throw new Error("Chọn giờ khởi hành từ hiện tại đến 7 ngày tới.");
    return new Date(time).toISOString();
  }
  async function plan(event: FormEvent) {
    event.preventDefault();
    if (planning || (!route && (!origin.selected || !destination.selected)))
      return;
    setError(undefined);
    try {
      const departureAt = searchTime();
      if (route) {
        if (new Date(route.expiresAt).getTime() <= Date.now()) {
          clearRoute();
          throw new Error("Tuyến đường đã hết hạn. Vui lòng tính lại.");
        }
        setStage("matches");
        discovery.mutate({
          routeId: route.id,
          role: mode,
          departureAt,
          seats: effectiveSeats,
        });
        return;
      }
      const token = ++generation.current.route;
      setPlanning(true);
      const next = await routingApi.createRoute(
        origin.selected!.placeRef,
        destination.selected!.placeRef,
        vehicleMode,
      );
      if (token !== generation.current.route) return;
      setRoute(next);
      try {
        const value = await routingApi.createEstimate(
          next.id,
          next.distanceMeters,
          effectiveSeats,
        );
        if (token === generation.current.route) setEstimate(value);
      } catch {
        if (token === generation.current.route)
          setError("Đã tính tuyến đường. Chưa tải được đóng góp gợi ý.");
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPlanning(false);
    }
  }
  const stats = route ? (
    <div className="ride-inline-stats">
      <span>
        <MapPin size={19} />
        <small className={stage === "matches" ? "sr-only" : undefined}>
          Khoảng cách
        </small>
        <strong>{distance(route.distanceMeters)}</strong>
      </span>
      <span>
        <Clock3 size={19} />
        <small className={stage === "matches" ? "sr-only" : undefined}>
          Thời gian
        </small>
        <strong>
          {Math.max(1, Math.ceil(route.durationSeconds / 60))} phút
        </strong>
      </span>
      <span>
        <Coins size={19} />
        <small className={stage === "matches" ? "sr-only" : undefined}>
          Đóng góp gợi ý
        </small>
        <strong>{estimate ? money(estimate.amountVnd) : "—"}</strong>
      </span>
    </div>
  ) : null;
  const map = (
    <>
      <div className="unified-map-header">
        <h2>
          {stage === "matches" ? "Hành trình của bạn" : "Xem trước tuyến đường"}
        </h2>
        <div className="unified-map-layer-toggle">
          {(["map", "satellite"] as const).map((layer) => (
            <button
              key={layer}
              type="button"
              className={mapLayer === layer ? "active" : ""}
              aria-pressed={mapLayer === layer}
              onClick={() => setMapLayer(layer)}
            >
              {layer === "map" ? "Bản đồ" : "Vệ tinh"}
            </button>
          ))}
        </div>
      </div>
      <div className="unified-map-canvas">
        <RouteMap
          route={route}
          origin={route?.origin.displayLabel || "Điểm đi"}
          destination={route?.destination.displayLabel || "Điểm đến"}
          driver={member}
          layer={mapLayer}
          padding={stage === "matches" ? 56 : 64}
          routeColor={mode === "passenger" ? "#e9bd52" : "#07966e"}
        />
      </div>
      {stats}
    </>
  );
  return (
    <main
      className={`unified-ride-page-v2 unified-ride-page-v2--${mode} ride-compose-page`}
    >
      <section className="unified-ride-intro">
        <p>Tạo hành trình</p>
        <h1>
          {mode === "driver"
            ? "Chia sẻ chỗ trống, cùng một hành trình"
            : "Tìm người đồng hành cho chuyến đi"}
        </h1>
        <span>
          Lên tuyến đường, tìm chuyến phù hợp hoặc chia sẻ hành trình của bạn.
        </span>
        <div
          className="unified-mode-switch"
          role="group"
          aria-label="Vai trò trong hành trình"
        >
          <button
            type="button"
            disabled={publishingStarted || planning}
            aria-pressed={mode === "driver"}
            onClick={() => choose("driver")}
          >
            <CarFront />
            Tôi chở<small>Có chỗ trống</small>
          </button>
          <button
            type="button"
            disabled={publishingStarted || planning}
            aria-pressed={mode === "passenger"}
            onClick={() => choose("passenger")}
          >
            <Users />
            Tôi đi ké<small>Cần người chở</small>
          </button>
        </div>
      </section>
      {stage === "edit" ? (
        <section className="unified-ride-body">
          <form className="unified-left-panel" onSubmit={plan}>
            <div className="unified-panel-header">
              <span className="unified-panel-icon">
                <CarFront size={22} />
              </span>
              <div>
                <h2>Thông tin chuyến đi</h2>
              </div>
            </div>
            <div className="unified-place-group">
              <PlacePicker
                label="Điểm đi"
                state={
                  route && !origin.query
                    ? { ...origin, query: route.origin.displayLabel }
                    : origin
                }
                update={(next) => updatePicker("origin", next)}
                onSearch={() => void search("origin")}
                onSelect={(item) => void select("origin", item)}
              />
              <button
                className="unified-swap-btn"
                type="button"
                aria-label="Đổi điểm đi và điểm đến"
                disabled={planning}
                onClick={() => {
                  generation.current.origin++;
                  generation.current.destination++;
                  setOrigin({ ...destination, loading: false });
                  setDestination({ ...origin, loading: false });
                  clearRoute();
                }}
              >
                <ArrowDownUp size={16} />
              </button>
              <PlacePicker
                label="Điểm đến"
                state={
                  route && !destination.query
                    ? { ...destination, query: route.destination.displayLabel }
                    : destination
                }
                update={(next) => updatePicker("destination", next)}
                onSearch={() => void search("destination")}
                onSelect={(item) => void select("destination", item)}
              />
            </div>
            <label className="ride-compose-field">
              <span>
                <CalendarClock size={17} /> Ngày giờ khởi hành
              </span>
              <input
                type="datetime-local"
                required
                value={departure}
                onChange={(e) => {
                  setDeparture(e.target.value);
                  setImmediate(false);
                }}
              />
            </label>
            <div className="unified-options-row">
              <div>
                <span className="unified-option-label">Phương tiện</span>
                <div
                  className="unified-vehicle-icons"
                  role="group"
                  aria-label="Phương tiện"
                >
                  {(["MOTORBIKE", "CAR"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-label={v === "CAR" ? "Ô tô" : "Xe máy"}
                      aria-pressed={vehicleMode === v}
                      disabled={planning}
                      onClick={() => {
                        clearRoute();
                        setVehicleMode(v);
                        setSeats(1);
                      }}
                    >
                      {v === "CAR" ? (
                        <CarFront size={23} />
                      ) : (
                        <Bike size={23} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="unified-option-label">
                  {mode === "driver" ? "Số chỗ trống" : "Số chỗ cần"}
                </span>
                <div
                  className={`unified-seats-control ${maxSeats === 1 ? "is-fixed" : ""}`}
                >
                  <Users size={17} />
                  {maxSeats > 1 && (
                    <button
                      className="unified-seats-btn"
                      type="button"
                      aria-label="Giảm số chỗ"
                      disabled={seats <= 1 || planning}
                      onClick={() => {
                        setSeats(seats - 1);
                        clearRoute();
                      }}
                    >
                      <Minus size={15} />
                    </button>
                  )}
                  <output className="unified-seats-value" aria-label="Số chỗ">
                    {effectiveSeats}
                  </output>
                  {maxSeats > 1 && (
                    <button
                      className="unified-seats-btn"
                      type="button"
                      aria-label="Tăng số chỗ"
                      disabled={seats >= maxSeats || planning}
                      onClick={() => {
                        setSeats(seats + 1);
                        clearRoute();
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <label className="ride-compose-field">
              <span>
                Lời nhắn <small>(không bắt buộc)</small>
              </span>
              <textarea
                rows={2}
                maxLength={500}
                placeholder="Ví dụ: Mình có thể ghé đón dọc đường…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && <ErrorState message={error} />}
            {initialRouteId && !ignoreInitialRoute && importedRoute.isError && (
              <ErrorState
                message={messageOf(importedRoute.error)}
                onRetry={() => void importedRoute.refetch()}
              />
            )}
            <button
              type="submit"
              className="unified-plan-btn"
              disabled={
                planning ||
                (!route && (!origin.selected || !destination.selected)) ||
                !departure
              }
            >
              <Search size={18} />
              {planning
                ? "Đang tính tuyến…"
                : route
                  ? "Bắt đầu tìm chuyến"
                  : "Tính tuyến đường"}
              <ArrowRight size={17} />
            </button>
          </form>
          <aside className="unified-right-panel">{map}</aside>
        </section>
      ) : (
        <section className="unified-ride-body ride-discovery-layout">
          <aside className="unified-right-panel ride-draft-preview">
            {map}
            <div className="ride-draft-content">
              <div className="ride-draft-author">
                <MemberAvatar
                  className="ride-compose-avatar"
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  size={42}
                />
                <div>
                  <strong>{member.name}</strong>
                  <small>
                    {mode === "driver" ? "Tôi chở" : "Tôi đi ké"} ·{" "}
                    {vehicleMode === "CAR" ? "Ô tô" : "Xe máy"} ·{" "}
                    {effectiveSeats} chỗ
                  </small>
                </div>
              </div>
              <div className="ride-draft-route">
                <p>
                  <i />
                  <span title={route?.origin.displayLabel}>
                    {route?.origin.displayLabel}
                  </span>
                </p>
                <p>
                  <i />
                  <span title={route?.destination.displayLabel}>
                    {route?.destination.displayLabel}
                  </span>
                </p>
              </div>
              <div className="ride-draft-meta">
                <p className="ride-draft-time">
                  <CalendarClock size={17} />
                  {immediate ? "Đi ngay" : dateLabel(departure)}
                </p>
                <label className="ride-compose-field ride-draft-audience">
                  <span className="sr-only">Chế độ bài đăng</span>
                  <select
                    value={audience}
                    disabled={publishingStarted}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    <option value="PUBLIC">Công khai</option>
                    <option value="FRIENDS">Bạn bè</option>
                    <option value="DRAFT">Bản nháp</option>
                  </select>
                </label>
              </div>
              {note && (
                <p className="ride-draft-note" title={note}>
                  <span>{note}</span>
                </p>
              )}
              {mode === "driver" &&
                (!vehicle || !capabilities.data?.canCreateTrip) && (
                  <p className="ride-compose-notice">
                    Bạn cần phương tiện đã duyệt để đăng chuyến.{" "}
                    <Link href="/profile">Cập nhật hồ sơ</Link>
                  </p>
                )}
              {publish.isError && (
                <ErrorState message={messageOf(publish.error)} />
              )}
              <div className="ride-draft-actions">
                <button
                  type="button"
                  className="ride-compose-secondary"
                  aria-label="Quay lại chỉnh sửa"
                  disabled={publishingStarted}
                  onClick={() => {
                    setStage("edit");
                    publish.reset();
                  }}
                >
                  <ArrowLeft size={17} />
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  className="unified-plan-btn"
                  disabled={
                    publish.isPending ||
                    (mode === "driver" &&
                      (!vehicle || !capabilities.data?.canCreateTrip))
                  }
                  onClick={() => publish.mutate()}
                >
                  <Send size={17} />
                  {publish.isPending ? "Đang đăng…" : "Đăng bài"}
                </button>
              </div>
            </div>
          </aside>
          <section
            className="ride-discovery-results"
            aria-live="polite"
            aria-label="Kết quả tìm chuyến"
          >
            {sent && (
              <p className="ride-discovery-success">
                <Check size={18} />
                {sent}
              </p>
            )}
            {discovery.isPending ? (
              <LoadingState label="Đang tìm chuyến phù hợp" />
            ) : discovery.isError ? (
              <ErrorState
                message={messageOf(discovery.error)}
                onRetry={() => {
                  try {
                    discovery.mutate({
                      routeId: route!.id,
                      role: mode,
                      departureAt: searchTime(),
                      seats: effectiveSeats,
                    });
                  } catch (e) {
                    setError(messageOf(e));
                  }
                }}
              />
            ) : discovery.data?.items.length ? (
              <>
                <p className="sr-only">
                  {discovery.data.items.length} gợi ý phù hợp · Kiểm tra lại
                  điểm đón khi gửi yêu cầu
                </p>
                {discovery.data.items.map((item) => {
                  const sentForPost = sentPostIds.has(item.post.id);
                  return (
                    <article
                      className={`ride-discovery-card ${item.post.type === "OFFER_RIDE" ? "is-offer" : "is-need"}`}
                      key={item.post.id}
                    >
                      <header>
                        <MemberAvatar
                          className="ride-compose-avatar"
                          name={item.post.ownerDisplayName}
                          avatarUrl={item.post.ownerAvatarUrl}
                          size={44}
                        />
                        <div>
                          <strong>{item.post.ownerDisplayName}</strong>
                          <small>
                            Hành trình công khai ·{" "}
                            {dateLabel(item.post.departureAt)}
                            {" · "}
                            {item.post.vehicleType === "CAR"
                              ? "Ô tô"
                              : "Xe máy"}
                          </small>
                        </div>
                        <span>
                          {item.timeDifferenceMinutes === 0
                            ? "Cùng giờ"
                            : `${Math.abs(item.timeDifferenceMinutes)} phút ${item.timeDifferenceMinutes > 0 ? "sau" : "trước"}`}
                        </span>
                      </header>
                      <div className="ride-draft-route">
                        <p>
                          <i />
                          <span>
                            <small>Điểm đi</small>
                            <strong>{item.post.originLabel}</strong>
                          </span>
                        </p>
                        <p>
                          <i />
                          <span>
                            <small>Điểm đến</small>
                            <strong>{item.post.destinationLabel}</strong>
                          </span>
                        </p>
                      </div>
                      {item.post.note && (
                        <p className="ride-match-note">{item.post.note}</p>
                      )}
                      <div className="ride-match-distances">
                        <span>
                          Điểm đón cách tuyến ~
                          {distance(item.pickupDistanceMeters)}
                        </span>
                        <span>
                          Điểm đến cách tuyến ~
                          {distance(item.destinationDistanceMeters)}
                        </span>
                      </div>
                      <footer>
                        <Link
                          href={`/feed/${encodeURIComponent(item.post.id)}`}
                        >
                          Xem chi tiết
                        </Link>
                        <button
                          type="button"
                          className={sentForPost ? "is-sent" : undefined}
                          disabled={sentForPost}
                          onClick={() => {
                            if (sentForPost) return;
                            offer.reset();
                            setResponseMessage("");
                            setResponsePost(item.post);
                          }}
                        >
                          {sentForPost
                            ? "Đã gửi yêu cầu"
                            : mode === "driver"
                              ? "Đề nghị chở"
                              : "Yêu cầu đi ké"}
                          {sentForPost ? (
                            <Check size={16} />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </>
            ) : (
              <div className="ride-discovery-empty">
                <span>
                  <Search size={28} />
                </span>
                <h3>Chưa tìm thấy chuyến phù hợp</h3>
                <p>
                  Bạn có thể điều chỉnh hành trình hoặc đăng bài để những người
                  khác tìm thấy bạn.
                </p>
              </div>
            )}
          </section>
        </section>
      )}
      {responsePost?.type === "OFFER_RIDE" ? (
        <PassengerRequest
          key={`${responsePost.id}:${route?.id}`}
          post={responsePost}
          initialJourney={route}
          initialMessage={note}
          onClose={() => setResponsePost(undefined)}
          onSent={() => {
            setSentPostIds((current) => new Set(current).add(responsePost.id));
            setSent(
              "Đã gửi yêu cầu đi ké. Bài đang soạn của bạn chưa được đăng.",
            );
          }}
        />
      ) : responsePost ? (
        <div
          className="home-response-modal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !offer.isPending)
              setResponsePost(undefined);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ride-offer-title"
          >
            <button
              className="home-response-close"
              type="button"
              aria-label="Đóng"
              disabled={offer.isPending}
              onClick={() => setResponsePost(undefined)}
            >
              <X />
            </button>
            <div className="home-response-heading">
              <span>
                <Send size={25} />
              </span>
              <h2 id="ride-offer-title">Gửi đề nghị chở?</h2>
            </div>
            <p className="home-response-description">
              Gửi yêu cầu tới {responsePost.ownerDisplayName}. Bài đang soạn của
              bạn chưa được đăng.
            </p>
            <div className="ride-draft-route">
              <p>
                <i />
                <span>{responsePost.originLabel}</span>
              </p>
              <p>
                <i />
                <span>{responsePost.destinationLabel}</span>
              </p>
            </div>
            <label className="ride-compose-field">
              <span>Lời nhắn (không bắt buộc)</span>
              <textarea
                autoFocus
                rows={3}
                maxLength={300}
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
              />
            </label>
            {offer.isError && <ErrorState message={messageOf(offer.error)} />}
            <div className="home-response-actions">
              <button
                type="button"
                disabled={offer.isPending}
                onClick={() => setResponsePost(undefined)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="is-submit"
                disabled={offer.isPending}
                onClick={() => offer.mutate()}
              >
                {offer.isPending ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
function PlacePicker({
  label,
  state,
  update,
  onSearch,
  onSelect,
}: {
  label: string;
  state: Picker;
  update: (value: Picker) => void;
  onSearch: () => void;
  onSelect: (item: PlaceSuggestionResponse) => void;
}) {
  return (
    <div className="unified-place-picker">
      <div className="unified-place-input-row">
        <MapPin size={17} className="unified-place-pin" />
        <input
          aria-label={label}
          value={state.query}
          placeholder={`Nhập ${label.toLowerCase()}`}
          onChange={(e) => update({ ...emptyPicker(), query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSearch();
            }
          }}
        />
        <button
          className="unified-place-search-btn"
          type="button"
          aria-label={`Tìm ${label.toLowerCase()}`}
          disabled={state.loading}
          onClick={onSearch}
        >
          <Search size={18} />
        </button>
      </div>
      {state.suggestions.length > 0 && (
        <ul className="unified-place-suggestions">
          {state.suggestions.map((item) => (
            <li key={item.placeRef}>
              <button
                type="button"
                disabled={state.loading}
                onClick={() => onSelect(item)}
              >
                <strong>{item.mainText}</strong>
                <span>{item.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.searched &&
        !state.loading &&
        !state.selected &&
        !state.suggestions.length && (
          <p className="unified-place-empty">Không có kết quả phù hợp.</p>
        )}
    </div>
  );
}
