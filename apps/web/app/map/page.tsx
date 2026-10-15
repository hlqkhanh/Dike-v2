"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import {
  ArrowDownUp,
  CarFront,
  MapPin,
  MapPinned,
  Search,
  Users,
} from "lucide-react";
import { ApiError } from "@dike/api-client-ts";
import { routingApi } from "../../src/routing/client";
import type {
  ContributionEstimate,
  PlaceResponse,
  PlaceSuggestionResponse,
  RouteResponse,
  VehicleMode,
} from "../../src/routing/api";
import { ErrorState, LoadingState, PageHeader } from "../components/app-ui";

const RouteMap = dynamic(() => import("../../src/rides/post-route-map"), {
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

export default function MapPage() {
  const [origin, setOrigin] = useState<Picker>(emptyPicker);
  const [destination, setDestination] = useState<Picker>(emptyPicker);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>("MOTORBIKE");
  const [seats, setSeats] = useState(1);
  const [route, setRoute] = useState<RouteResponse>();
  const [estimate, setEstimate] = useState<ContributionEstimate>();
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();

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

  return (
    <main className="settings-page map-page-v2">
      <PageHeader
        eyebrow="Khám phá hành trình"
        title="Tìm tuyến đường"
        description="Chọn hai địa điểm để xem lộ trình, thời gian dự kiến và mức đóng góp gợi ý."
      />
      <div className="map-planner-layout">
        <form className="settings-card map-planner-panel" onSubmit={plan}>
          <div className="map-picker-stack">
            <PlacePicker
              label="Điểm đi"
              state={origin}
              update={setOrigin}
              onSearch={() => search(origin, setOrigin)}
              onSelect={(item) => select(item, origin, setOrigin)}
            />
            <button
              className="app-icon-button map-swap-button"
              type="button"
              aria-label="Đổi điểm đi và điểm đến"
              onClick={swap}
            >
              <ArrowDownUp aria-hidden="true" size={18} />
            </button>
            <PlacePicker
              label="Điểm đến"
              state={destination}
              update={setDestination}
              onSearch={() => search(destination, setDestination)}
              onSelect={(item) => select(item, destination, setDestination)}
            />
          </div>
          <div className="form-grid form-grid--two">
            <label className="dike-field">
              <span>Phương tiện</span>
              <select
                value={vehicleMode}
                onChange={(event) =>
                  setVehicleMode(event.target.value as VehicleMode)
                }
              >
                <option value="MOTORBIKE">Xe máy</option>
                <option value="CAR">Ô tô</option>
              </select>
            </label>
            <label className="dike-field">
              <span>Số người chia sẻ</span>
              <input
                type="number"
                min={1}
                max={4}
                value={seats}
                onChange={(event) => setSeats(Number(event.target.value))}
              />
            </label>
          </div>
          {error ? <ErrorState message={error} /> : null}
          <button
            className="app-button app-button--primary"
            disabled={planning || !origin.selected || !destination.selected}
          >
            {planning ? "Đang tính tuyến…" : "Tính tuyến đường"}
          </button>
        </form>
        <section
          className="settings-card map-canvas-card"
          aria-label="Bản đồ tuyến đường"
        >
          <RouteMap
            route={route}
            origin={route?.origin.displayLabel || "Điểm đi"}
            destination={route?.destination.displayLabel || "Điểm đến"}
          />
          {!route ? (
            <div className="map-empty-overlay">
              <MapPinned aria-hidden="true" size={30} />
              <h2>Chưa có tuyến đường</h2>
              <p>Chọn điểm đi và điểm đến để bắt đầu.</p>
            </div>
          ) : null}
        </section>
      </div>
      {route ? (
        <section className="settings-card route-result-card">
          <div className="route-result-heading">
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
          <div className="route-result-stats">
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
              <small>Đóng góp gợi ý</small>
              <strong>
                {estimate ? money(estimate.amountVnd) : "Đang tính…"}
              </strong>
            </span>
          </div>
          <div className="route-result-actions">
            <Link
              className="app-button app-button--primary"
              href={`/feed/new?route=${encodeURIComponent(route.id)}`}
            >
              Đăng nhu cầu đi cùng
            </Link>
            <Link
              className="app-button app-button--secondary"
              href={`/trips/new?route=${encodeURIComponent(route.id)}`}
            >
              Tạo chuyến tài xế
            </Link>
          </div>
        </section>
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
    <div className="place-picker-v2">
      <label className="dike-field">
        <span>{label}</span>
        <span className="place-search-control">
          <MapPin aria-hidden="true" size={18} />
          <input
            value={state.query}
            placeholder={`Nhập ${label.toLowerCase()}`}
            onChange={(event) =>
              update({
                ...state,
                query: event.target.value,
                selected: undefined,
              })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
          />
          <button
            className="app-icon-button"
            type="button"
            aria-label={`Tìm ${label.toLowerCase()}`}
            disabled={state.loading}
            onClick={onSearch}
          >
            <Search aria-hidden="true" size={18} />
          </button>
        </span>
      </label>
      {state.selected ? (
        <p className="place-selected">
          Đã chọn: {state.selected.publicAreaLabel}
        </p>
      ) : null}
      {state.suggestions.length ? (
        <ul className="place-suggestion-list">
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
        <p className="form-hint">Không có kết quả phù hợp.</p>
      ) : null}
    </div>
  );
}
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
