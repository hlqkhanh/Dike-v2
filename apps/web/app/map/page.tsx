"use client";

import { ApiError } from "@dike/api-client-ts";
import { Button } from "@dike/web-ui";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const DynamicMap = dynamic(() => import("./DynamicMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "400px",
        background: "#f3f4f6",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      Đang tải bản đồ...
    </div>
  ),
});

import { routingApi } from "../../src/routing/client";
import {
  type ContributionEstimate,
  type PlaceResponse,
  type PlaceSuggestionResponse,
  type RoutePoint,
  type RouteResponse,
  type VehicleMode,
} from "../../src/routing/api";

type PickerState = {
  query: string;
  sessionToken?: string;
  suggestions: PlaceSuggestionResponse[];
  selected?: PlaceResponse;
  loading: boolean;
  searched: boolean;
};

const emptyPicker: PickerState = {
  query: "",
  suggestions: [],
  loading: false,
  searched: false,
};

export default function MapPage() {
  const [origin, setOrigin] = useState<PickerState>(emptyPicker);
  const [destination, setDestination] = useState<PickerState>(emptyPicker);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>("MOTORBIKE");
  const [route, setRoute] = useState<RouteResponse>();
  const [estimate, setEstimate] = useState<ContributionEstimate>();
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string>();

  async function search(
    query: string,
    update: (value: PickerState) => void,
    current: PickerState,
  ) {
    if (query.trim().length < 3) {
      setError("Nhập ít nhất 3 ký tự để tìm địa điểm.");
      return;
    }
    setError(undefined);
    update({
      ...current,
      query,
      loading: true,
      searched: true,
      selected: undefined,
    });
    try {
      const session = await routingApi.createPlaceSession();
      const suggestions = await routingApi.autocompletePlaces(
        session.sessionToken,
        query.trim(),
      );
      update({
        query,
        sessionToken: session.sessionToken,
        suggestions,
        selected: undefined,
        loading: false,
        searched: true,
      });
    } catch (searchError) {
      update({ ...current, query, loading: false, searched: true });
      setError(messageOf(searchError));
    }
  }

  async function selectPlace(
    suggestion: PlaceSuggestionResponse,
    update: (value: PickerState) => void,
    current: PickerState,
  ) {
    if (!current.sessionToken) {
      setError("Phiên chọn địa điểm đã hết hạn, hãy tìm lại.");
      return;
    }
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
    } catch (selectError) {
      update({ ...current, loading: false });
      setError(messageOf(selectError));
    }
  }

  async function planRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!origin.selected || !destination.selected) {
      setError("Chọn đủ điểm đi và điểm đến trước khi tính tuyến.");
      return;
    }
    setPlanning(true);
    setError(undefined);
    setRoute(undefined);
    setEstimate(undefined);
    try {
      const nextRoute = await routingApi.createRoute(
        origin.selected.placeRef,
        destination.selected.placeRef,
        vehicleMode,
      );
      setRoute(nextRoute);
      const nextEstimate = await routingApi.createEstimate(
        nextRoute.id,
        nextRoute.distanceMeters,
        vehicleMode === "CAR" ? 3 : 1,
      );
      setEstimate(nextEstimate);
    } catch (routeError) {
      setError(messageOf(routeError));
    } finally {
      setPlanning(false);
    }
  }

  return (
    <main className="shell map-page">
      <nav className="nav" aria-label="Điều hướng bản đồ">
        <Link className="brand" href="/" aria-label="Dike — Trang đầu">
          <span className="brand__mark" aria-hidden="true">
            D
          </span>
          <span>Dike</span>
        </Link>
        <Link className="stage-badge" href="/friends">
          Bạn bè
        </Link>
      </nav>

      <section className="map-hero">
        <p className="eyebrow">Stage 7/8 routing</p>
        <h1>Xem tuyến đường</h1>
        <p>
          Tìm hai địa điểm bằng Goong qua backend, sau đó Dike tính khoảng cách,
          thời gian và gợi ý đóng góp. API key chỉ nằm ở server.
        </p>
      </section>

      <form className="map-grid" onSubmit={planRoute}>
        <section className="dike-card map-panel" aria-label="Chọn tuyến đường">
          <PlacePicker
            label="Điểm đi"
            placeholder="Ví dụ: FPT University Hồ Chí Minh"
            state={origin}
            onQueryChange={(query) =>
              setOrigin({ ...origin, query, selected: undefined })
            }
            onSearch={() => search(origin.query, setOrigin, origin)}
            onSelect={(suggestion) =>
              selectPlace(suggestion, setOrigin, origin)
            }
          />
          <PlacePicker
            label="Điểm đến"
            placeholder="Ví dụ: Landmark 81"
            state={destination}
            onQueryChange={(query) =>
              setDestination({ ...destination, query, selected: undefined })
            }
            onSearch={() =>
              search(destination.query, setDestination, destination)
            }
            onSelect={(suggestion) =>
              selectPlace(suggestion, setDestination, destination)
            }
          />

          <label className="dike-field" htmlFor="vehicle-mode">
            <span>Phương tiện</span>
            <select
              id="vehicle-mode"
              value={vehicleMode}
              onChange={(event) =>
                setVehicleMode(event.target.value as VehicleMode)
              }
            >
              <option value="MOTORBIKE">Xe máy</option>
              <option value="CAR">Ô tô</option>
            </select>
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <Button
            type="submit"
            disabled={planning || !origin.selected || !destination.selected}
          >
            {planning ? "Đang tính tuyến…" : "Tính tuyến"}
          </Button>
        </section>

        <section
          className="dike-card map-preview"
          aria-label="Bản đồ tuyến"
          style={{
            padding: "0",
            height: "600px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {route ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <DynamicMap route={route.geometry} />
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  left: "16px",
                  right: "16px",
                  background: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
                  zIndex: 1000,
                }}
              >
                <RouteSummary route={route} estimate={estimate} />
              </div>
            </div>
          ) : (
            <div
              className="map-empty"
              style={{ flex: 1, position: "relative" }}
            >
              <DynamicMap route={undefined} />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(255,255,255,0.9)",
                  padding: "24px",
                  borderRadius: "16px",
                  textAlign: "center",
                  zIndex: 1000,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                }}
              >
                <h2>Bản đồ tuyến đường</h2>
                <p style={{ margin: 0 }}>
                  Chọn điểm đi và điểm đến rồi bấm <strong>Tính tuyến</strong>{" "}
                  để xem đường đi trên bản đồ thật.
                </p>
              </div>
            </div>
          )}
        </section>
      </form>
    </main>
  );
}

function PlacePicker({
  label,
  placeholder,
  state,
  onQueryChange,
  onSearch,
  onSelect,
}: {
  label: string;
  placeholder: string;
  state: PickerState;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (suggestion: PlaceSuggestionResponse) => void;
}) {
  return (
    <div className="place-picker">
      <label className="dike-field">
        <span>{label}</span>
        <span className="place-picker__row">
          <input
            value={state.query}
            placeholder={placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={state.loading}
            onClick={onSearch}
          >
            {state.loading ? "Đang tìm…" : "Tìm"}
          </Button>
        </span>
      </label>

      {state.selected ? (
        <p className="place-picker__selected">
          Đã chọn: {state.selected.publicAreaLabel}
        </p>
      ) : null}

      {state.suggestions.length > 0 ? (
        <ul className="place-suggestions">
          {state.suggestions.map((suggestion) => (
            <li key={suggestion.placeRef}>
              <button type="button" onClick={() => onSelect(suggestion)}>
                <strong>{suggestion.mainText}</strong>
                <span>{suggestion.secondaryText}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {state.searched &&
      !state.loading &&
      !state.selected &&
      state.suggestions.length === 0 ? (
        <p className="place-picker__empty">
          Không có kết quả. Thử nhập tên đầy đủ hơn, ví dụ “FPT University Quy
          Nhon”.
        </p>
      ) : null}
    </div>
  );
}

function MapCanvasPlaceholder() {
  return (
    <svg
      className="map-canvas"
      viewBox="0 0 100 64"
      role="img"
      aria-label="Map background preview"
    >
      <rect width="100" height="64" rx="5" />
      <path
        className="map-canvas__park"
        d="M2 48 C24 36 31 56 50 45 S82 39 98 52 V64 H2 Z"
      />
      <path
        className="map-canvas__water"
        d="M0 18 C18 12 30 20 45 15 S77 3 100 12 V0 H0 Z"
      />
      <path
        className="map-canvas__road map-canvas__road--wide"
        d="M7 56 C26 42 34 42 50 30 S72 13 94 9"
      />
      <path
        className="map-canvas__road"
        d="M8 25 C24 26 33 31 46 35 S75 43 94 39"
      />
      <path className="map-canvas__road" d="M22 8 C27 22 31 34 38 55" />
      <path className="map-canvas__road" d="M68 8 C63 22 62 38 70 58" />
      <circle className="map-canvas__pin" cx="50" cy="30" r="2.4" />
    </svg>
  );
}

function RoutePreview({ geometry }: { geometry: RoutePoint[] }) {
  const path = useMemo(() => toSvgPath(geometry), [geometry]);
  return (
    <svg
      className="route-svg"
      viewBox="0 0 100 64"
      role="img"
      aria-label="Route preview"
    >
      <defs>
        <pattern
          id="route-grid"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="currentColor" />
        </pattern>
      </defs>
      <rect width="100" height="64" rx="5" />
      <rect className="route-svg__grid" width="100" height="64" rx="5" />
      <path className="route-svg__line-shadow" d={path.d} />
      <path className="route-svg__line" d={path.d} />
      <circle
        className="route-svg__pin route-svg__pin--origin"
        {...path.start}
        r="2.2"
      />
      <circle
        className="route-svg__pin route-svg__pin--destination"
        {...path.end}
        r="2.2"
      />
    </svg>
  );
}

function RouteSummary({
  route,
  estimate,
}: {
  route: RouteResponse;
  estimate?: ContributionEstimate;
}) {
  return (
    <div className="route-summary">
      <div>
        <span>Khoảng cách</span>
        <strong>{formatDistance(route.distanceMeters)}</strong>
      </div>
      <div>
        <span>Thời gian</span>
        <strong>{formatDuration(route.durationSeconds)}</strong>
      </div>
      <div>
        <span>Đóng góp gợi ý</span>
        <strong>
          {estimate ? formatCurrency(estimate.amountVnd) : "Đang tính…"}
        </strong>
      </div>
      <p>
        {route.origin.publicAreaLabel} → {route.destination.publicAreaLabel}
      </p>
    </div>
  );
}

function toSvgPath(points: RoutePoint[]) {
  const safePoints =
    points.length >= 2
      ? points
      : [
          { longitude: 106.6297, latitude: 10.8231 },
          { longitude: 106.7009, latitude: 10.7769 },
        ];
  const longitudes = safePoints.map((point) => point.longitude);
  const latitudes = safePoints.map((point) => point.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.001);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.001);
  const padding = 6;
  const width = 100 - padding * 2;
  const height = 64 - padding * 2;
  const projected = safePoints.map((point) => ({
    cx: padding + ((point.longitude - minLongitude) / longitudeSpan) * width,
    cy: padding + ((maxLatitude - point.latitude) / latitudeSpan) * height,
  }));
  return {
    d: projected
      .map(
        (point, index) => `${index === 0 ? "M" : "L"} ${point.cx} ${point.cy}`,
      )
      .join(" "),
    start: projected[0],
    end: projected[projected.length - 1],
  };
}

function formatDistance(value: number) {
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toLocaleString("vi-VN", {
    maximumFractionDigits: 1,
  })} km`;
}

function formatDuration(value: number) {
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  });
}

function messageOf(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Bạn cần đăng nhập trước khi xem bản đồ.";
    if (error.status === 403) {
      return "Tài khoản cần hoàn tất xác minh trước khi dùng định tuyến.";
    }
    return error.message;
  }
  return "Không thể xử lý yêu cầu bản đồ. Thử lại sau ít phút.";
}
