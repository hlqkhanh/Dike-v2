"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  Clock3,
  Eye,
  FileText,
  Map,
  MapPin,
  Route,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../app/components/app-ui";
import { useAuthFailure } from "../auth/use-auth-failure";
import { routingApi } from "../routing/client";
import { rideApi } from "./api";
import { useRideCommand } from "./dashboard";

const displayDateTime = (value: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa chọn";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const dateTimeLocalValue = (timestamp: number) => {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const displayDuration = (seconds: number) => {
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours ? `${hours} giờ` : "", minutes ? `${minutes} phút` : ""]
    .filter(Boolean)
    .join(" ");
};

export function NewPost({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [visibility, setVisibility] = useState("FRIENDS");
  const [note, setNote] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    updateTime();
    const timer = window.setInterval(updateTime, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const route = useQuery({
    queryKey: ["rides", "source-route", routeId],
    queryFn: () => routingApi.getRoute(routeId),
    enabled: Boolean(routeId),
    retry: false,
  });
  const command = useRideCommand();
  useAuthFailure(route.error);
  const departureTime = departure ? new Date(departure).getTime() : 0;
  const arrivalTime = arrival ? new Date(arrival).getTime() : 0;
  const routeDurationMs = (route.data?.durationSeconds ?? 0) * 1000;
  const minimumArrivalTime = departureTime + routeDurationMs;
  const maximumArrivalTime = departureTime + SEVEN_DAYS_MS;
  const routeExpired = Boolean(
    currentTime &&
      route.data &&
      new Date(route.data.expiresAt).getTime() <= currentTime,
  );
  let timeError = "";
  if (currentTime && departureTime && departureTime <= currentTime) {
    timeError = "Thời gian khởi hành phải ở tương lai.";
  } else if (
    currentTime &&
    departureTime &&
    departureTime > currentTime + SEVEN_DAYS_MS
  ) {
    timeError = "Thời gian khởi hành phải nằm trong 7 ngày tới.";
  } else if (departureTime && arrivalTime && arrivalTime < minimumArrivalTime) {
    timeError = `Tuyến đường cần khoảng ${displayDuration(route.data?.durationSeconds ?? 0)}. Hãy chọn thời gian đến muộn hơn.`;
  } else if (departureTime && arrivalTime && arrivalTime > maximumArrivalTime) {
    timeError = "Khung giờ di chuyển không được vượt quá 7 ngày.";
  }
  const canSubmit = Boolean(
    departure && arrival && !timeError && !routeExpired,
  );
  const commandErrorCode = command.isError
    ? (command.error as { code?: string }).code
    : undefined;

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
        <section className="settings-card create-route-required">
          <MapPin aria-hidden="true" size={34} />
          <h2>Chưa chọn tuyến đường</h2>
          <p>Tuyến đường giúp Diké tìm đúng người có hành trình phù hợp.</p>
          <Link className="app-button app-button--primary" href="/map">
            Chọn tuyến trên bản đồ
          </Link>
        </section>
      </main>
    );

  return (
    <main className="need-post-page">
      <section className="need-post-hero">
        <div className="need-post-hero-inner">
          <Link className="need-post-back" href="/rides/new?mode=passenger">
            <ArrowLeft aria-hidden="true" size={17} /> Quay lại
          </Link>
          <div className="need-post-hero-copy">
            <p>Nhu cầu di chuyển</p>
            <h1>Đăng nhu cầu đi cùng</h1>
            <span>
              Cung cấp khung giờ và phạm vi chia sẻ, bạn có thể kiểm tra bản
              nháp trước khi đăng.
            </span>
          </div>
          <div className="need-post-hero-art" aria-hidden="true">
            <i className="need-post-city" />
            <i className="need-post-road" />
            <span className="need-post-car">
              <CarFront size={34} />
            </span>
            <span className="need-post-pin">
              <MapPin size={35} fill="currentColor" />
            </span>
            <i className="need-post-tree need-post-tree--one" />
            <i className="need-post-tree need-post-tree--two" />
          </div>
        </div>
      </section>

      {route.isPending ? (
        <div className="need-post-state">
          <LoadingState label="Đang kiểm tra tuyến đường" />
        </div>
      ) : route.isError ? (
        <div className="need-post-state">
          <ErrorState
            message={route.error.message}
            onRetry={() => void route.refetch()}
          />
        </div>
      ) : route.data ? (
        <div className="need-post-layout">
          <form
            className="need-post-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit) return;
              command.mutate({
                signature: [
                  "draft",
                  routeId,
                  departure,
                  arrival,
                  visibility,
                  note,
                ].join(":"),
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
                  router.push("/feed/" + encodeURIComponent(draft.id));
                  return draft;
                },
              });
            }}
          >
            <NeedPostSection
              number="1"
              title="Tuyến đường"
              description="Kiểm tra tuyến đường bạn muốn đi hoặc chọn lại nếu cần."
            >
              <div className="need-post-route-fields">
                <RoutePoint
                  label="Điểm đi"
                  value={route.data.origin.publicAreaLabel}
                />
                <i aria-hidden="true" />
                <RoutePoint
                  label="Điểm đến"
                  value={route.data.destination.publicAreaLabel}
                />
              </div>
              <div className="need-post-selected-route">
                <Route aria-hidden="true" size={18} />
                <span>
                  {route.data.origin.publicAreaLabel} →{" "}
                  {route.data.destination.publicAreaLabel}
                </span>
                <Link href="/rides/new?mode=passenger">Chọn lại</Link>
              </div>
            </NeedPostSection>

            <NeedPostSection
              number="2"
              title="Khung giờ"
              description="Chọn thời gian linh hoạt để tăng khả năng tìm được bạn đồng hành."
            >
              <div className="need-post-time-grid">
                <DateField
                  label="Có thể đi từ"
                  value={departure}
                  onChange={setDeparture}
                  min={
                    currentTime ? dateTimeLocalValue(currentTime) : undefined
                  }
                  max={
                    currentTime
                      ? dateTimeLocalValue(currentTime + SEVEN_DAYS_MS)
                      : undefined
                  }
                />
                <DateField
                  label="Cần đến trước"
                  value={arrival}
                  onChange={setArrival}
                  min={
                    departureTime
                      ? dateTimeLocalValue(minimumArrivalTime)
                      : undefined
                  }
                  max={
                    departureTime
                      ? dateTimeLocalValue(maximumArrivalTime)
                      : undefined
                  }
                />
              </div>
              <p className="need-post-duration">
                <Clock3 aria-hidden="true" size={16} /> Thời gian di chuyển ước
                tính: {displayDuration(route.data.durationSeconds)}
              </p>
              {routeExpired ? (
                <p className="need-post-error" role="alert">
                  Tuyến đường đã hết hiệu lực. Vui lòng chọn lại tuyến đường.
                </p>
              ) : timeError ? (
                <p className="need-post-error" role="alert">
                  {timeError}
                </p>
              ) : null}
            </NeedPostSection>

            <NeedPostSection
              number="3"
              title="Chia sẻ"
              description="Chọn ai có thể nhìn thấy nhu cầu này."
            >
              <label className="need-post-select">
                <Users aria-hidden="true" size={19} />
                <span className="sr-only">Ai được xem</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                >
                  <option value="FRIENDS">Bạn bè</option>
                  <option value="PUBLIC">Thành viên Diké</option>
                </select>
              </label>
            </NeedPostSection>

            <NeedPostSection
              number="4"
              title="Ghi chú"
              description="Không bắt buộc, bạn có thể thêm thông tin chi tiết hoặc lưu ý khác."
            >
              <label className="need-post-note">
                <span className="sr-only">Thông tin bổ sung</span>
                <textarea
                  maxLength={500}
                  rows={4}
                  placeholder="Ví dụ: điểm đón cụ thể, hành lý, yêu cầu đặc biệt,…"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <small>{note.length}/500</small>
              </label>
            </NeedPostSection>

            {command.isError ? (
              <p className="need-post-error" role="alert">
                {commandErrorCode === "SOURCE_ROUTE_CHANGED"
                  ? "Tuyến đường đã hết hiệu lực hoặc khung giờ chưa phù hợp. Vui lòng chọn lại tuyến và kiểm tra thời gian."
                  : command.error.message}
              </p>
            ) : null}
            <footer className="need-post-submit">
              <p>
                <ShieldCheck aria-hidden="true" size={17} /> Bài đăng được lưu
                dưới dạng bản nháp để bạn kiểm tra.
              </p>
              <button disabled={command.isPending || !canSubmit}>
                <Send aria-hidden="true" size={18} />
                {command.isPending ? "Đang lưu…" : "Lưu và xem bản nháp"}
              </button>
            </footer>
          </form>

          <aside className="need-post-summary">
            <header>
              <h2>Tóm tắt nhu cầu</h2>
              <span>
                <Map aria-hidden="true" size={22} />
              </span>
            </header>
            <div className="need-post-summary-route">
              <i className="is-origin" />
              <span>
                <strong>{route.data.origin.publicAreaLabel}</strong>
                <small>Điểm đi</small>
              </span>
              <b aria-hidden="true" />
              <i className="is-destination" />
              <span>
                <strong>{route.data.destination.publicAreaLabel}</strong>
                <small>Điểm đến</small>
              </span>
            </div>
            <dl>
              <SummaryItem
                icon={<CalendarDays />}
                label="Khởi hành"
                value={displayDateTime(departure)}
              />
              <SummaryItem
                icon={<Clock3 />}
                label="Cần đến trước"
                value={displayDateTime(arrival)}
              />
              <SummaryItem
                icon={<Eye />}
                label="Phạm vi chia sẻ"
                value={visibility === "FRIENDS" ? "Bạn bè" : "Thành viên Diké"}
              />
              {note ? (
                <SummaryItem icon={<FileText />} label="Ghi chú" value={note} />
              ) : null}
            </dl>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function NeedPostSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="need-post-section">
      <div className="need-post-section-heading">
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="need-post-section-content">{children}</div>
    </section>
  );
}

function RoutePoint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MapPin aria-hidden="true" size={18} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <span className="need-post-control">
        <CalendarDays aria-hidden="true" size={18} />
        <input
          type="datetime-local"
          required
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
