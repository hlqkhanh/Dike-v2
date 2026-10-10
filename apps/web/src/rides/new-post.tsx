"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Eye,
  FileText,
  MapPinned,
  Route,
  ShieldCheck,
} from "lucide-react";
import { routingApi } from "../routing/client";
import { rideApi } from "./api";
import { RideNav, useRideCommand } from "./dashboard";
import { useAuthFailure } from "../auth/use-auth-failure";
import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../app/components/app-ui";

export function NewPost({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [visibility, setVisibility] = useState("FRIENDS");
  const [note, setNote] = useState("");
  const route = useQuery({
    queryKey: ["rides", "source-route", routeId],
    queryFn: () => routingApi.getRoute(routeId),
    enabled: Boolean(routeId),
    retry: false,
  });
  const command = useRideCommand();
  useAuthFailure(route.error);
  const invalidWindow = Boolean(
    departure && arrival && new Date(arrival) <= new Date(departure),
  );
  if (!routeId)
    return (
      <main className="settings-page create-flow-page">
        <PageHeader
          backHref="/feed"
          backLabel="Bảng tin"
          eyebrow="Nhu cầu di chuyển"
          title="Đăng nhu cầu đi cùng"
          description="Bắt đầu bằng cách chọn điểm đi và điểm đến trên bản đồ."
        />
        <RideNav />
        <section className="settings-card create-route-required">
          <MapPinned aria-hidden="true" size={34} />
          <h2>Chưa chọn tuyến đường</h2>
          <p>Tuyến đường giúp Diké tìm đúng người có hành trình phù hợp.</p>
          <Link className="app-button app-button--primary" href="/map">
            Chọn tuyến trên bản đồ
          </Link>
        </section>
      </main>
    );
  return (
    <main className="settings-page create-flow-page">
      <PageHeader
        backHref="/feed"
        backLabel="Bảng tin"
        eyebrow="Nhu cầu di chuyển"
        title="Đăng nhu cầu đi cùng"
        description="Cung cấp khung giờ và phạm vi chia sẻ; bạn có thể kiểm tra bản nháp trước khi đăng."
      />
      <RideNav />
      {route.isPending ? (
        <LoadingState label="Đang kiểm tra tuyến đường" />
      ) : route.isError ? (
        <ErrorState
          message={route.error.message}
          onRetry={() => void route.refetch()}
        />
      ) : (
        <div className="create-flow-layout">
          <form
            className="settings-card trip-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (invalidWindow) return;
              command.mutate({
                signature: `draft:${routeId}:${departure}:${arrival}:${visibility}:${note}`,
                run: async (key) => {
                  const source = await rideApi.createSource(
                    {
                      routeId,
                      departureAt: new Date(departure).toISOString(),
                      arrivalAt: new Date(arrival).toISOString(),
                    },
                    key,
                  );
                  const draft = await rideApi.createPost(
                    {
                      type: "NEED_RIDE",
                      sourceId: source.id,
                      sourceVersion: source.version,
                      visibility,
                      note,
                    },
                    key,
                  );
                  router.push(`/feed/${encodeURIComponent(draft.id)}`);
                  return draft;
                },
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
                  <h2>Tuyến đường</h2>
                  <small>
                    Chỉ khu vực công khai được hiển thị cho thành viên khác.
                  </small>
                </div>
              </div>
              <div className="post-route-preview">
                <span>{route.data.origin.publicAreaLabel}</span>
                <i aria-hidden="true" />
                <span>{route.data.destination.publicAreaLabel}</span>
                <Link href="/map">Chọn lại</Link>
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <CalendarClock aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 2</p>
                  <h2>Khung giờ</h2>
                  <small>
                    Cho biết thời gian linh hoạt bạn có thể di chuyển.
                  </small>
                </div>
              </div>
              <div className="form-grid form-grid--two">
                <label className="dike-field">
                  <span>Có thể đi từ</span>
                  <input
                    type="datetime-local"
                    required
                    value={departure}
                    onChange={(event) => setDeparture(event.target.value)}
                  />
                </label>
                <label className="dike-field">
                  <span>Cần đến trước</span>
                  <input
                    type="datetime-local"
                    required
                    value={arrival}
                    onChange={(event) => setArrival(event.target.value)}
                  />
                </label>
              </div>
              {invalidWindow ? (
                <p className="auth-error" role="alert">
                  Thời gian đến phải sau thời gian khởi hành.
                </p>
              ) : null}
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <Eye aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 3</p>
                  <h2>Chia sẻ</h2>
                  <small>Chọn ai có thể nhìn thấy nhu cầu này.</small>
                </div>
              </div>
              <label className="dike-field">
                <span>Ai được xem</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                >
                  <option value="FRIENDS">Bạn bè</option>
                  <option value="PUBLIC">Thành viên Diké</option>
                </select>
              </label>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <span>
                  <FileText aria-hidden="true" size={19} />
                </span>
                <div>
                  <p>Bước 4</p>
                  <h2>Ghi chú</h2>
                  <small>
                    Không chia sẻ số điện thoại hoặc dữ liệu nhạy cảm.
                  </small>
                </div>
              </div>
              <label className="dike-field">
                <span>Thông tin bổ sung</span>
                <textarea
                  maxLength={500}
                  rows={5}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <small className="character-count">{note.length}/500</small>
            </section>
            {command.isError ? (
              <p className="auth-error" role="alert">
                {command.error.message}
              </p>
            ) : null}
            <div className="form-submit-row">
              <p>
                <ShieldCheck aria-hidden="true" size={17} /> Bài được lưu dưới
                dạng bản nháp để bạn kiểm tra.
              </p>
              <button
                className="app-button app-button--primary"
                disabled={command.isPending || invalidWindow}
              >
                {command.isPending ? "Đang lưu…" : "Lưu và xem bản nháp"}
              </button>
            </div>
          </form>
          <aside className="create-flow-aside app-panel">
            <p className="app-eyebrow">Tóm tắt</p>
            <h2>
              {route.data.origin.publicAreaLabel} →{" "}
              {route.data.destination.publicAreaLabel}
            </h2>
            <dl>
              <div>
                <dt>Khởi hành</dt>
                <dd>
                  {departure
                    ? new Date(departure).toLocaleString("vi-VN")
                    : "Chưa chọn"}
                </dd>
              </div>
              <div>
                <dt>Đến trước</dt>
                <dd>
                  {arrival
                    ? new Date(arrival).toLocaleString("vi-VN")
                    : "Chưa chọn"}
                </dd>
              </div>
              <div>
                <dt>Phạm vi</dt>
                <dd>
                  {visibility === "FRIENDS" ? "Bạn bè" : "Thành viên Diké"}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
