"use client";

import type { TripCreate } from "@dike/api-client-ts";
import { Button, Card, Input } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CarFront, MapPinned, Route, ShieldCheck, Users } from "lucide-react";

import { rideApi } from "../../../src/rides/api";
import { RideNav } from "../../../src/rides/dashboard";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

export default function NewTripPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const capabilities = useQuery({
    queryKey: ["rides", "capabilities"],
    queryFn: rideApi.capabilities,
  });
  const [vehicleId, setVehicleId] = useState("");
  const [routeId, setRouteId] = useState("");
  useEffect(() => {
    const update = window.setTimeout(() => {
      setRouteId(
        new URLSearchParams(window.location.search).get("route") ?? "",
      );
    }, 0);
    return () => window.clearTimeout(update);
  }, []);
  const create = useMutation({
    mutationFn: (body: TripCreate) =>
      rideApi.createTrip(body, crypto.randomUUID()),
    onSuccess: async (trip) => {
      await queryClient.invalidateQueries({ queryKey: ["rides", "trips"] });
      router.push(`/trips/${encodeURIComponent(trip.id)}`);
    },
  });

  const vehicles = capabilities.data?.vehicles ?? [];
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  return (
    <main className="settings-page create-flow-page">
      <PageHeader
        backHref="/trips"
        backLabel="Chuyến của tôi"
        eyebrow="Dành cho tài xế"
        title="Tạo chuyến đi"
        description="Chia sẻ lộ trình, thời gian và số chỗ trống để tìm đúng người đồng hành."
      />
      <RideNav />
      {capabilities.isPending ? (
        <LoadingState label="Đang tải quyền tài xế" />
      ) : null}
      {capabilities.isError ? (
        <ErrorState
          message="Không thể tải phương tiện. Hãy thử lại."
          onRetry={() => void capabilities.refetch()}
        />
      ) : null}
      {capabilities.data?.accessMode === "SIMULATED" ? (
        <p className="simulation-notice">
          Chuyến này sử dụng phương tiện thử nghiệm. Số điện thoại, eKYC và
          phương tiện của bạn chưa được xác minh thật.
        </p>
      ) : null}
      {capabilities.data && !capabilities.data.canCreateTrip ? (
        <Card>
          <p role="alert">
            Tài khoản hoặc hạ tầng hiện chưa sẵn sàng để tạo chuyến.
          </p>
        </Card>
      ) : null}
      {capabilities.data?.canCreateTrip ? (
        <div className="create-flow-layout">
          <form
            className="settings-card trip-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              create.mutate({
                vehicleId,
                routeId: String(data.get("routeId")),
                departureAt: new Date(
                  String(data.get("departureAt")),
                ).toISOString(),
                originLabel: String(data.get("originLabel")),
                destinationLabel: String(data.get("destinationLabel")),
                offeredSeats: Number(data.get("offeredSeats")),
                contributionPerKm: Number(data.get("contributionPerKm")),
                detourMeters: 0,
                detourSeconds: 0,
                visibility: String(data.get("visibility")),
                communityId: "",
              });
            }}
          >
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <Route aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 1</p>
                  <h2>Lộ trình</h2>
                  <small>Cho mọi người biết bạn đi đâu.</small>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <Input
                  label="Mã tuyến đường"
                  name="routeId"
                  required
                  value={routeId}
                  onChange={(event) => setRouteId(event.target.value)}
                />
                <span className="form-map-hint">
                  <MapPinned aria-hidden="true" size={17} /> Chọn tuyến ở trang
                  bản đồ để điền tự động
                </span>
                <Input
                  label="Điểm đi"
                  name="originLabel"
                  required
                  maxLength={120}
                />
                <Input
                  label="Điểm đến"
                  name="destinationLabel"
                  required
                  maxLength={120}
                />
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <CarFront aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 2</p>
                  <h2>Phương tiện & chỗ ngồi</h2>
                  <small>Thiết lập sức chứa và mức đóng góp.</small>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label className="dike-field">
                  <span>Phương tiện</span>
                  <select
                    required
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                  >
                    <option value="">Chọn phương tiện</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.displayName} · tối đa{" "}
                        {vehicle.passengerCapacity} khách
                      </option>
                    ))}
                  </select>
                </label>
                {selectedVehicle ? (
                  <span className="status-pill status-pill--warning">
                    Phương tiện thử nghiệm
                  </span>
                ) : null}
                <Input
                  label="Số ghế"
                  name="offeredSeats"
                  type="number"
                  required
                  min={1}
                  max={selectedVehicle?.passengerCapacity ?? 1}
                  defaultValue={1}
                />
                <Input
                  label="Đóng góp mỗi km (VND)"
                  name="contributionPerKm"
                  type="number"
                  required
                  min={500}
                  max={10000}
                  defaultValue={1000}
                />
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <Users aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 3</p>
                  <h2>Thời gian & phạm vi</h2>
                  <small>
                    Chọn thời điểm khởi hành và ai có thể thấy chuyến.
                  </small>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <Input
                  label="Khởi hành"
                  name="departureAt"
                  type="datetime-local"
                  required
                />
                <label className="dike-field">
                  <span>Phạm vi hiển thị</span>
                  <select name="visibility" defaultValue="PUBLIC">
                    <option value="PUBLIC">Công khai</option>
                    <option value="FRIENDS">Bạn bè</option>
                  </select>
                </label>
              </div>
            </section>
            {create.isError ? <p role="alert">{create.error.message}</p> : null}
            <div className="form-submit-row">
              <p>
                <ShieldCheck aria-hidden="true" size={17} /> Bạn có thể chỉnh
                sửa trước khi đăng công khai.
              </p>
              <Button type="submit" disabled={create.isPending || !vehicleId}>
                {create.isPending ? "Đang tạo…" : "Tạo bản nháp chuyến"}
              </Button>
            </div>
          </form>
          <aside className="create-flow-aside app-panel">
            <p className="app-eyebrow">Tiến độ</p>
            <ol>
              <li className="is-active">
                <span>1</span>
                <div>
                  <strong>Lộ trình</strong>
                  <small>Điểm đi và điểm đến</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Phương tiện</strong>
                  <small>Chỗ ngồi và chi phí</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Hoàn tất</strong>
                  <small>Thời gian và phạm vi</small>
                </div>
              </li>
            </ol>
            <Link className="app-button app-button--secondary" href="/map">
              <MapPinned aria-hidden="true" size={17} /> Chọn trên bản đồ
            </Link>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
