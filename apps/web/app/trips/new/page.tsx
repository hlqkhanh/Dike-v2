"use client";

import type { TripCreate } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CarFront,
  Check,
  Clock3,
  Coins,
  Eye,
  MapPin,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useMemo, useState } from "react";

import { rideApi } from "../../../src/rides/api";
import { routingApi } from "../../../src/routing/client";
import { ErrorState, LoadingState } from "../../components/app-ui";

const DynamicMap = dynamic(() => import("../../map/DynamicMap"), {
  ssr: false,
  loading: () => <LoadingState label="Đang tải bản đồ" />,
});

export default function NewTripPage() {
  return (
    <Suspense fallback={<TripCreateFallback />}>
      <NewTripForm />
    </Suspense>
  );
}

function NewTripForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const routeId = searchParams.get("route") ?? "";
  const [vehicleOverride, setVehicleOverride] = useState<string>();
  const [originOverride, setOriginOverride] = useState<string>();
  const [destinationOverride, setDestinationOverride] = useState<string>();
  const [offeredSeats, setOfferedSeats] = useState(() =>
    positiveNumber(searchParams.get("seats"), 1),
  );
  const [contributionPerKm, setContributionPerKm] = useState(() =>
    positiveNumber(searchParams.get("contributionPerKm"), 1000),
  );
  const [departureAt, setDepartureAt] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [detourMeters, setDetourMeters] = useState(1000);
  const [detourMinutes, setDetourMinutes] = useState(5);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const update = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(update);
  }, []);

  const capabilities = useQuery({
    queryKey: ["rides", "capabilities"],
    queryFn: rideApi.capabilities,
  });
  const route = useQuery({
    queryKey: ["routing", "route", routeId],
    queryFn: () => routingApi.getRoute(routeId),
    enabled: Boolean(routeId),
  });

  const vehicles = useMemo(
    () => capabilities.data?.vehicles ?? [],
    [capabilities.data?.vehicles],
  );
  const suggestedVehicleId = useMemo(() => {
    if (!route.data || !vehicles.length) return "";
    const expectedType =
      route.data.vehicleMode === "MOTORBIKE" ? "MOTORCYCLE" : "CAR";
    return vehicles.find((vehicle) => vehicle.type === expectedType)?.id ?? "";
  }, [route.data, vehicles]);
  const vehicleId = vehicleOverride ?? suggestedVehicleId;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const validOfferedSeats = selectedVehicle
    ? Math.min(Math.max(offeredSeats, 1), selectedVehicle.passengerCapacity)
    : offeredSeats;
  const originLabel = originOverride ?? route.data?.origin.displayLabel ?? "";
  const destinationLabel =
    destinationOverride ?? route.data?.destination.displayLabel ?? "";

  const create = useMutation({
    mutationFn: (body: TripCreate) =>
      rideApi.createTrip(body, crypto.randomUUID()),
    onSuccess: async (trip) => {
      await queryClient.invalidateQueries({ queryKey: ["rides", "trips"] });
      router.push(`/trips/${encodeURIComponent(trip.id)}`);
    },
  });

  const routeExpired = route.data
    ? currentTime > 0 && new Date(route.data.expiresAt).getTime() <= currentTime
    : false;
  const estimatedContribution = useMemo(
    () =>
      route.data
        ? Math.round(
            ((route.data.distanceMeters / 1000) * contributionPerKm) / 1000,
          ) * 1000
        : 0,
    [contributionPerKm, route.data],
  );
  const canSubmit = Boolean(
    capabilities.data?.canCreateTrip &&
      route.data &&
      !routeExpired &&
      selectedVehicle &&
      departureAt &&
      originLabel.trim() &&
      destinationLabel.trim(),
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate({
      vehicleId,
      routeId,
      departureAt: new Date(departureAt).toISOString(),
      originLabel: originLabel.trim(),
      destinationLabel: destinationLabel.trim(),
      offeredSeats: validOfferedSeats,
      contributionPerKm,
      detourMeters,
      detourSeconds: detourMinutes * 60,
      visibility,
      communityId: "",
    });
  }

  return (
    <main className="trip-create-page">
      <section className="trip-create-hero">
        <div className="trip-create-hero-inner">
          <Link className="trip-create-back" href="/rides/new?mode=driver">
            <ArrowLeft aria-hidden="true" size={17} /> Quay lại chọn tuyến
          </Link>
          <p>Hoàn thiện hành trình</p>
          <h1>Thiết lập chuyến đi của bạn</h1>
          <span>
            Xác nhận lộ trình, phương tiện và thời gian trước khi tạo bản nháp.
          </span>
          <nav className="trip-create-stepper" aria-label="Tiến độ tạo chuyến">
            <div className="is-complete">
              <span>
                <Check aria-hidden="true" size={16} />
              </span>
              <strong>Chọn tuyến đường</strong>
            </div>
            <i aria-hidden="true" />
            <div className="is-active">
              <span>2</span>
              <strong>Thông tin chuyến</strong>
            </div>
            <i aria-hidden="true" />
            <div>
              <span>3</span>
              <strong>Xác nhận</strong>
            </div>
          </nav>
        </div>
      </section>

      <section className="trip-create-layout">
        <form className="trip-create-form" onSubmit={submit}>
          <div className="trip-create-card trip-route-card">
            <div className="trip-create-section-heading">
              <span>
                <Route aria-hidden="true" size={20} />
              </span>
              <div>
                <p>Lộ trình đã chọn</p>
                <h2>Xác nhận điểm đi và điểm đến</h2>
                <small>Dữ liệu tuyến được tải từ bước chọn bản đồ.</small>
              </div>
              {route.data && !routeExpired ? (
                <em className="trip-route-status">Có hiệu lực</em>
              ) : null}
            </div>

            {!routeId ? (
              <div className="trip-create-empty">
                <MapPin aria-hidden="true" />
                <div>
                  <strong>Chưa có tuyến đường</strong>
                  <p>Hãy chọn điểm đi và điểm đến trước khi tạo chuyến.</p>
                </div>
                <Link href="/rides/new?mode=driver">Chọn tuyến đường</Link>
              </div>
            ) : null}
            {route.isPending ? (
              <LoadingState label="Đang tải thông tin tuyến" />
            ) : null}
            {route.isError ? (
              <ErrorState
                message="Không thể tải tuyến đường hoặc tuyến đã hết hạn."
                onRetry={() => void route.refetch()}
              />
            ) : null}
            {routeExpired ? (
              <div className="trip-create-warning" role="alert">
                Tuyến đường đã hết hiệu lực. Vui lòng quay lại tính tuyến mới.
              </div>
            ) : null}
            {route.data ? (
              <div className="trip-route-fields">
                <label className="trip-create-field">
                  <span>Điểm đi</span>
                  <span className="trip-create-input">
                    <MapPin aria-hidden="true" size={17} />
                    <input
                      required
                      maxLength={120}
                      value={originLabel}
                      onChange={(event) =>
                        setOriginOverride(event.target.value)
                      }
                    />
                  </span>
                </label>
                <label className="trip-create-field">
                  <span>Điểm đến</span>
                  <span className="trip-create-input">
                    <MapPin aria-hidden="true" size={17} />
                    <input
                      required
                      maxLength={120}
                      value={destinationLabel}
                      onChange={(event) =>
                        setDestinationOverride(event.target.value)
                      }
                    />
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="trip-create-card">
            <div className="trip-create-section-heading">
              <span>
                <CarFront aria-hidden="true" size={20} />
              </span>
              <div>
                <p>Phương tiện & chỗ ngồi</p>
                <h2>Bạn sẽ chở bằng phương tiện nào?</h2>
                <small>Số ghế được giới hạn theo phương tiện đã chọn.</small>
              </div>
            </div>

            {capabilities.isPending ? (
              <LoadingState label="Đang tải phương tiện" />
            ) : null}
            {capabilities.isError ? (
              <ErrorState
                message="Không thể tải phương tiện. Hãy thử lại."
                onRetry={() => void capabilities.refetch()}
              />
            ) : null}
            {capabilities.data?.accessMode === "SIMULATED" ? (
              <div className="trip-create-notice" role="status">
                <ShieldCheck aria-hidden="true" size={18} />
                <span>
                  <strong>Chế độ thử nghiệm</strong>
                  Phương tiện, số điện thoại và eKYC chưa được xác minh thật.
                </span>
              </div>
            ) : null}
            {capabilities.data && !capabilities.data.canCreateTrip ? (
              <div className="trip-create-warning" role="alert">
                Tài khoản hoặc hạ tầng hiện chưa sẵn sàng để tạo chuyến.
              </div>
            ) : null}
            {capabilities.data?.canCreateTrip ? (
              <div className="trip-create-grid trip-create-grid--three">
                <label className="trip-create-field trip-create-field--wide">
                  <span>Phương tiện</span>
                  <span className="trip-create-input">
                    <CarFront aria-hidden="true" size={17} />
                    <select
                      required
                      value={vehicleId}
                      onChange={(event) =>
                        setVehicleOverride(event.target.value)
                      }
                    >
                      <option value="">Chọn phương tiện</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.displayName} · tối đa{" "}
                          {vehicle.passengerCapacity}
                          {" khách"}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <label className="trip-create-field">
                  <span>Số ghế trống</span>
                  <span className="trip-create-input">
                    <Users aria-hidden="true" size={17} />
                    <input
                      type="number"
                      required
                      min={1}
                      max={selectedVehicle?.passengerCapacity ?? 1}
                      value={validOfferedSeats}
                      onChange={(event) =>
                        setOfferedSeats(Number(event.target.value))
                      }
                    />
                  </span>
                </label>
                <label className="trip-create-field">
                  <span>Quãng đường ghé đón tối đa (m)</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={100}
                    required
                    value={detourMeters}
                    onChange={(e) => setDetourMeters(Number(e.target.value))}
                  />
                </label>
                <label className="trip-create-field">
                  <span>Thời gian phát sinh tối đa (phút)</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    required
                    value={detourMinutes}
                    onChange={(e) => setDetourMinutes(Number(e.target.value))}
                  />
                </label>
                <label className="trip-create-field">
                  <span>Đóng góp mỗi km</span>
                  <span className="trip-create-input">
                    <Coins aria-hidden="true" size={17} />
                    <input
                      type="number"
                      required
                      min={500}
                      max={10000}
                      step={500}
                      value={contributionPerKm}
                      onChange={(event) =>
                        setContributionPerKm(Number(event.target.value))
                      }
                    />
                    <b>đ</b>
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="trip-create-card">
            <div className="trip-create-section-heading">
              <span>
                <CalendarClock aria-hidden="true" size={20} />
              </span>
              <div>
                <p>Thời gian & phạm vi</p>
                <h2>Khi nào bạn muốn khởi hành?</h2>
                <small>Chọn thời điểm và những người có thể thấy chuyến.</small>
              </div>
            </div>
            <div className="trip-create-grid">
              <label className="trip-create-field">
                <span>Thời gian khởi hành</span>
                <span className="trip-create-input">
                  <Clock3 aria-hidden="true" size={17} />
                  <input
                    type="datetime-local"
                    required
                    value={departureAt}
                    onChange={(event) => setDepartureAt(event.target.value)}
                  />
                </span>
              </label>
              <label className="trip-create-field">
                <span>Phạm vi hiển thị</span>
                <span className="trip-create-input">
                  <Eye aria-hidden="true" size={17} />
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value)}
                  >
                    <option value="PUBLIC">Công khai</option>
                    <option value="FRIENDS">Chỉ bạn bè</option>
                  </select>
                </span>
              </label>
            </div>
          </div>

          {create.isError ? (
            <ErrorState message={create.error.message} />
          ) : null}
          <div className="trip-create-submit">
            <p>
              <ShieldCheck aria-hidden="true" size={18} />
              Chuyến được lưu dưới dạng bản nháp để bạn kiểm tra trước khi đăng.
            </p>
            <button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Đang tạo bản nháp…" : "Tạo bản nháp chuyến"}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </form>

        <aside className="trip-create-summary" aria-label="Tóm tắt chuyến đi">
          <div className="trip-create-summary-card">
            <div className="trip-create-summary-heading">
              <div>
                <p>Xem trước chuyến đi</p>
                <h2>Tóm tắt hành trình</h2>
              </div>
              {route.data ? <span>{route.data.provider}</span> : null}
            </div>
            <div className="trip-create-map">
              <DynamicMap route={route.data?.geometry} />
            </div>
            {route.data ? (
              <>
                <div className="trip-summary-route">
                  <div>
                    <i className="is-origin" />
                    <span>
                      <small>Điểm đi</small>
                      <strong>{route.data.origin.publicAreaLabel}</strong>
                    </span>
                  </div>
                  <div>
                    <i className="is-destination" />
                    <span>
                      <small>Điểm đến</small>
                      <strong>{route.data.destination.publicAreaLabel}</strong>
                    </span>
                  </div>
                </div>
                <div className="trip-summary-stats">
                  <span>
                    <MapPin aria-hidden="true" size={17} />
                    <small>Khoảng cách</small>
                    <strong>{distance(route.data.distanceMeters)}</strong>
                  </span>
                  <span>
                    <Clock3 aria-hidden="true" size={17} />
                    <small>Thời gian</small>
                    <strong>{duration(route.data.durationSeconds)}</strong>
                  </span>
                  <span>
                    <Coins aria-hidden="true" size={17} />
                    <small>Đóng góp dự kiến</small>
                    <strong>{money(estimatedContribution)}</strong>
                  </span>
                </div>
              </>
            ) : (
              <p className="trip-summary-placeholder">
                Thông tin tuyến sẽ xuất hiện sau khi tải xong.
              </p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function TripCreateFallback() {
  return (
    <main className="trip-create-page">
      <section className="trip-create-hero">
        <div className="trip-create-hero-inner">
          <p>Hoàn thiện hành trình</p>
          <h1>Thiết lập chuyến đi của bạn</h1>
        </div>
      </section>
      <section className="trip-create-layout">
        <div className="trip-create-card">
          <LoadingState label="Đang chuẩn bị thông tin chuyến" />
        </div>
      </section>
    </main>
  );
}

function positiveNumber(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
