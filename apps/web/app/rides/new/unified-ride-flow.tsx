"use client";

import {
  ArrowDownUp,
  ArrowRight,
  Bike,
  CarFront,
  Info,
  MapPin,
  Minus,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import { ApiError } from "@dike/api-client-ts";
import { routingApi } from "../../../src/routing/client";
import type {
  ContributionEstimate,
  PlaceResponse,
  PlaceSuggestionResponse,
  RouteResponse,
  VehicleMode,
} from "../../../src/routing/api";
import { ErrorState, LoadingState } from "../../components/app-ui";

const DynamicMap = dynamic(() => import("../../map/DynamicMap"), {
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

export function UnifiedRideFlow({
  initialMode,
}: {
  initialMode: "driver" | "passenger";
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [origin, setOrigin] = useState<Picker>(emptyPicker);
  const [destination, setDestination] = useState<Picker>(emptyPicker);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>("MOTORBIKE");
  const [seats, setSeats] = useState(1);
  const [route, setRoute] = useState<RouteResponse>();
  const [estimate, setEstimate] = useState<ContributionEstimate>();
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();
  const [mapLayer, setMapLayer] = useState<"map" | "satellite">("map");

  function choose(next: "driver" | "passenger") {
    setMode(next);
    router.replace(`/rides/new?mode=${next}`, { scroll: false });
  }

  async function search(current: Picker, update: (value: Picker) => void) {
    const query = current.query.trim();
    if (query.length < 3)
      return setError("Nhập ít nhất 3 ký tự để tìm địa điểm.");
    setError(undefined);
    update({ ...current, loading: true, searched: true, selected: undefined });
    try {
      const session = await routingApi.createPlaceSession();
      const suggestions = await routingApi.autocompletePlaces(
        session.sessionToken,
        query,
      );
      update({
        query,
        sessionToken: session.sessionToken,
        suggestions,
        loading: false,
        searched: true,
      });
    } catch (cause) {
      update({ ...current, loading: false, searched: true });
      setError(messageOf(cause));
    }
  }

  async function select(
    suggestion: PlaceSuggestionResponse,
    current: Picker,
    update: (value: Picker) => void,
  ) {
    if (!current.sessionToken)
      return setError("Phiên chọn địa điểm đã hết hạn. Hãy tìm lại.");
    setError(undefined);
    update({ ...current, query: suggestion.displayLabel, loading: true });
    try {
      const selected = await routingApi.resolvePlace(
        current.sessionToken,
        suggestion.placeRef,
      );
      update({
        query: selected.displayLabel,
        suggestions: [],
        selected,
        loading: false,
        searched: true,
      });
    } catch (cause) {
      update({ ...current, loading: false });
      setError(messageOf(cause));
    }
  }

  async function plan(event: FormEvent) {
    event.preventDefault();
    if (!origin.selected || !destination.selected)
      return setError("Chọn đủ điểm đi và điểm đến trước khi tính tuyến.");
    setPlanning(true);
    setError(undefined);
    setRoute(undefined);
    setEstimate(undefined);
    try {
      const next = await routingApi.createRoute(
        origin.selected.placeRef,
        destination.selected.placeRef,
        vehicleMode,
      );
      setRoute(next);
      setEstimate(
        await routingApi.createEstimate(next.id, next.distanceMeters, seats),
      );
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPlanning(false);
    }
  }

  function swap() {
    setOrigin(destination);
    setDestination(origin);
    setRoute(undefined);
    setEstimate(undefined);
  }

  function changeVehicleMode(next: VehicleMode) {
    setVehicleMode(next);
    setRoute(undefined);
    setEstimate(undefined);
  }

  return (
    <main className={`unified-ride-page-v2 unified-ride-page-v2--${mode}`}>
      <section className="unified-ride-intro">
        <p>Tạo hành trình</p>
        <h1>
          {mode === "driver"
            ? "Bạn muốn chở ai hôm nay?"
            : "Bạn muốn đi ké đến đâu?"}
        </h1>
        <span>
          Chọn vai trò, lên tuyến đường và xem các lựa chọn phù hợp trước khi
          đăng.
        </span>
        <div
          className="unified-mode-switch"
          role="group"
          aria-label="Vai trò trong hành trình"
        >
          <button
            type="button"
            aria-pressed={mode === "driver"}
            onClick={() => choose("driver")}
          >
            <CarFront aria-hidden="true" />
            Tôi chở<small>Có chỗ trống</small>
          </button>
          <button
            type="button"
            aria-pressed={mode === "passenger"}
            onClick={() => choose("passenger")}
          >
            <Users aria-hidden="true" />
            Tôi đi ké<small>Cần người chở</small>
          </button>
        </div>
      </section>

      {/* ── Main content: left form + right map ── */}
      <section className="unified-ride-body">
        {/* LEFT PANEL: Trip info form */}
        <form className="unified-left-panel" onSubmit={plan}>
          {/* Card header */}
          <div className="unified-panel-header">
            <span className="unified-panel-icon">
              <CarFront size={20} />
            </span>
            <div>
              <h2>Thông tin chuyến đi</h2>
              <p>Nhập điểm đi, điểm đến và phương tiện của bạn.</p>
            </div>
          </div>

          {/* Place pickers */}
          <div className="unified-place-group">
            <PlacePicker
              label="Điểm đi"
              dotColor="green"
              state={origin}
              update={setOrigin}
              onSearch={() => search(origin, setOrigin)}
              onSelect={(item) => select(item, origin, setOrigin)}
            />
            <button
              className="unified-swap-btn"
              type="button"
              aria-label="Đổi điểm đi và điểm đến"
              onClick={swap}
            >
              <ArrowDownUp size={16} />
            </button>
            <PlacePicker
              label="Điểm đến"
              dotColor="red"
              state={destination}
              update={setDestination}
              onSearch={() => search(destination, setDestination)}
              onSelect={(item) => select(item, destination, setDestination)}
            />
          </div>

          {/* Vehicle & seats row */}
          <div className="unified-options-row">
            <div className="unified-option-vehicle">
              <span className="unified-option-label">Phương tiện</span>
              <div
                className="unified-vehicle-icons"
                role="group"
                aria-label="Phương tiện"
              >
                <button
                  type="button"
                  aria-label="Xe máy"
                  title="Xe máy"
                  aria-pressed={vehicleMode === "MOTORBIKE"}
                  onClick={() => changeVehicleMode("MOTORBIKE")}
                >
                  <Bike aria-hidden="true" size={23} />
                </button>
                <button
                  type="button"
                  aria-label="Ô tô"
                  title="Ô tô"
                  aria-pressed={vehicleMode === "CAR"}
                  onClick={() => changeVehicleMode("CAR")}
                >
                  <CarFront aria-hidden="true" size={23} />
                </button>
              </div>
            </div>
            <div className="unified-option-seats">
              <span className="unified-option-label">
                {mode === "driver" ? "Số chỗ trống" : "Số chỗ cần"}
              </span>
              <div className="unified-seats-control">
                <span className="unified-seats-icon" aria-hidden="true">
                  <Users size={16} />
                </span>
                <button
                  type="button"
                  className="unified-seats-btn"
                  aria-label="Giảm"
                  disabled={seats <= 1}
                  onClick={() => setSeats(Math.max(1, seats - 1))}
                >
                  <Minus size={14} />
                </button>
                <span className="unified-seats-value">{seats}</span>
                <button
                  type="button"
                  className="unified-seats-btn"
                  aria-label="Tăng"
                  disabled={seats >= 4}
                  onClick={() => setSeats(Math.min(4, seats + 1))}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {error ? <ErrorState message={error} /> : null}

          {/* Submit button */}
          <button
            type="submit"
            className="unified-plan-btn"
            disabled={planning || !origin.selected || !destination.selected}
          >
            <Users size={18} />
            {planning ? "Đang tính tuyến…" : "Tính tuyến đường"}
            <ArrowRight size={16} />
          </button>

          {/* Hint note */}
          <p className="unified-hint-note">
            <Info size={14} />
            <span>
              Sau khi tính tuyến, bạn có thể hoàn tất thời gian và{" "}
              {mode === "driver" ? "đăng chuyến" : "đăng nhu cầu"}.
            </span>
          </p>
        </form>

        {/* RIGHT PANEL: Map preview */}
        <div className="unified-right-panel">
          <div className="unified-map-header">
            <h2>Xem trước tuyến đường</h2>
            <p>Tuyến đường sẽ hiển thị sau khi bạn nhập điểm đi và điểm đến.</p>
            <div className="unified-map-layer-toggle">
              <button
                type="button"
                className={mapLayer === "map" ? "active" : ""}
                aria-pressed={mapLayer === "map"}
                onClick={() => setMapLayer("map")}
              >
                Bản đồ
              </button>
              <button
                type="button"
                className={mapLayer === "satellite" ? "active" : ""}
                aria-pressed={mapLayer === "satellite"}
                onClick={() => setMapLayer("satellite")}
              >
                Vệ tinh
              </button>
            </div>
          </div>
          <div className="unified-map-canvas">
            <DynamicMap route={route?.geometry} layer={mapLayer} />
          </div>
        </div>
      </section>

      {/* ── Stepper ── */}
      <nav className="unified-stepper" aria-label="Các bước tạo chuyến">
        <div className="unified-step unified-step--active">
          <span className="unified-step-number">1</span>
          <span className="unified-step-label">Chọn tuyến đường</span>
        </div>
        <div className="unified-step-line" />
        <div className="unified-step">
          <span className="unified-step-number">2</span>
          <span className="unified-step-label">Thông tin chuyến</span>
        </div>
        <div className="unified-step-line" />
        <div className="unified-step">
          <span className="unified-step-number">3</span>
          <span className="unified-step-label">Xác nhận</span>
        </div>
      </nav>

      {/* Route result (shown after planning) */}
      {route ? (
        <section className="unified-route-result">
          <div className="unified-route-result-heading">
            <div>
              <p className="app-eyebrow">Tuyến đã tính</p>
              <h2>
                {route.origin.publicAreaLabel} →{" "}
                {route.destination.publicAreaLabel}
              </h2>
            </div>
            <span className="status-pill status-pill--success">
              Có hiệu lực
            </span>
          </div>
          <div className="unified-route-result-stats">
            <span>
              <MapPin aria-hidden="true" size={18} />
              <small>Khoảng cách</small>
              <strong>{distance(route.distanceMeters)}</strong>
            </span>
            <span>
              <CarFront aria-hidden="true" size={18} />
              <small>Thời gian</small>
              <strong>{duration(route.durationSeconds)}</strong>
            </span>
            <span>
              <Users aria-hidden="true" size={18} />
              <small>Đóng góp gợi ý{estimate?.demo ? " (mô phỏng)" : ""}</small>
              <strong>
                {estimate ? money(estimate.amountVnd) : "Đang tính…"}
              </strong>
            </span>
          </div>
          <div className="unified-route-result-actions">
            <Link
              className="app-button app-button--primary"
              href={
                mode === "driver"
                  ? `/trips/new?route=${encodeURIComponent(route.id)}&seats=${seats}&contributionPerKm=${estimate?.suggestedPerKmVnd ?? 1000}`
                  : `/feed/new?route=${encodeURIComponent(route.id)}`
              }
            >
              {mode === "driver"
                ? "Tiếp tục tạo chuyến"
                : "Tiếp tục đăng nhu cầu"}
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

/* ─── Place Picker sub-component ─── */
function PlacePicker({
  label,
  dotColor,
  state,
  update,
  onSearch,
  onSelect,
}: {
  label: string;
  dotColor: "green" | "red";
  state: Picker;
  update: (value: Picker) => void;
  onSearch: () => void;
  onSelect: (item: PlaceSuggestionResponse) => void;
}) {
  return (
    <div className="unified-place-picker">
      <label className="unified-place-label">
        <span className={`unified-place-dot unified-place-dot--${dotColor}`} />
      </label>
      <div className="unified-place-input-row">
        <MapPin size={16} className="unified-place-pin" />
        <input
          aria-label={label}
          value={state.query}
          placeholder={`Nhập ${label.toLowerCase()}`}
          onChange={(e) =>
            update({ ...state, query: e.target.value, selected: undefined })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
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
          <Search size={16} />
        </button>
      </div>
      {state.suggestions.length ? (
        <ul className="unified-place-suggestions">
          {state.suggestions.map((item) => (
            <li key={item.placeRef}>
              <button type="button" onClick={() => onSelect(item)}>
                <strong>{item.mainText}</strong>
                <span>{item.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {state.searched &&
      !state.loading &&
      !state.selected &&
      !state.suggestions.length ? (
        <p className="unified-place-empty">Không có kết quả phù hợp.</p>
      ) : null}
    </div>
  );
}

/* ─── Utility helpers ─── */
const distance = (value: number) =>
  value < 1000
    ? `${Math.round(value)} m`
    : `${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;

const duration = (value: number) => {
  const minutes = Math.max(1, Math.round(value / 60));
  return minutes < 60
    ? `${minutes} phút`
    : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
};

const money = (value: number) =>
  value.toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });

function messageOf(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "Không thể xử lý yêu cầu bản đồ. Vui lòng thử lại.";
}
