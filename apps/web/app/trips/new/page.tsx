"use client";

import type { TripCreate } from "@dike/api-client-ts";
import { Button, Card, Input } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { rideApi } from "../../../src/rides/api";
import { RideNav } from "../../../src/rides/dashboard";

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
    <main className="settings-page">
      <p className="eyebrow">Tài xế thử nghiệm</p>
      <h1>Tạo chuyến đi</h1>
      <RideNav />
      {capabilities.isPending ? (
        <p role="status">Đang tải quyền tài xế…</p>
      ) : null}
      {capabilities.isError ? (
        <p role="alert">Không thể tải phương tiện. Hãy thử lại.</p>
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
                  {vehicle.displayName} · tối đa {vehicle.passengerCapacity}{" "}
                  khách
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
            label="Mã tuyến đường"
            name="routeId"
            required
            value={routeId}
            onChange={(event) => setRouteId(event.target.value)}
          />
          <Input label="Điểm đi" name="originLabel" required maxLength={120} />
          <Input
            label="Điểm đến"
            name="destinationLabel"
            required
            maxLength={120}
          />
          <Input
            label="Khởi hành"
            name="departureAt"
            type="datetime-local"
            required
          />
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
          <label className="dike-field">
            <span>Phạm vi hiển thị</span>
            <select name="visibility" defaultValue="PUBLIC">
              <option value="PUBLIC">Công khai</option>
              <option value="FRIENDS">Bạn bè</option>
            </select>
          </label>
          {create.isError ? <p role="alert">{create.error.message}</p> : null}
          <Button type="submit" disabled={create.isPending || !vehicleId}>
            {create.isPending ? "Đang tạo…" : "Tạo bản nháp chuyến"}
          </Button>
        </form>
      ) : null}
    </main>
  );
}
