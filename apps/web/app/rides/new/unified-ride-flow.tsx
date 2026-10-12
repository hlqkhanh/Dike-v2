"use client";

import { CarFront, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import MapPage from "../../map/page";

export function UnifiedRideFlow({
  initialMode,
}: {
  initialMode: "driver" | "passenger";
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  function choose(next: "driver" | "passenger") {
    setMode(next);
    router.replace(`/rides/new?mode=${next}`, { scroll: false });
  }
  return (
    <main className="unified-ride-page">
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
      <div className={`unified-map-flow unified-map-flow--${mode}`}>
        <MapPage />
      </div>
      <p className="unified-flow-note" role="note">
        Sau khi tính tuyến, chọn{" "}
        <strong>{mode === "driver" ? "Tạo chuyến" : "Đăng nhu cầu"}</strong> để
        hoàn tất thông tin thời gian, phương tiện và phạm vi hiển thị.
      </p>
    </main>
  );
}
