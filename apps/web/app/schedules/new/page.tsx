"use client";

import type { RuleRequest } from "@dike/api-client-ts";
import { Button, Input } from "@dike/web-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Clock3, MapPinned, Settings2 } from "lucide-react";

import { scheduleApi } from "../../../src/schedules/api";
import { PageHeader } from "../../components/app-ui";

const weekdays = [
  ["MONDAY", "T2"],
  ["TUESDAY", "T3"],
  ["WEDNESDAY", "T4"],
  ["THURSDAY", "T5"],
  ["FRIDAY", "T6"],
  ["SATURDAY", "T7"],
  ["SUNDAY", "CN"],
] as const;

export default function NewSchedulePage() {
  const router = useRouter();
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: scheduleApi.create,
    onSuccess: async (schedule) => {
      await client.invalidateQueries({ queryKey: ["schedules"] });
      router.push(`/schedules/${encodeURIComponent(schedule.id)}`);
    },
  });
  return (
    <main className="settings-page create-flow-page">
      <PageHeader
        backHref="/schedules"
        backLabel="Lịch trình của tôi"
        eyebrow="Thiết lập một lần"
        title="Tạo lịch trình"
        description="Diké sẽ dựa trên lịch này để tạo nhu cầu di chuyển và gợi ý người đi cùng phù hợp."
        actions={
          <Link className="app-button app-button--secondary" href="/rides/new">
            <MapPinned aria-hidden="true" size={17} /> Chọn địa điểm
          </Link>
        }
      />
      <form
        className="settings-card trip-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          create.mutate({
            name: String(data.get("name")),
            activityCategory: String(data.get("activityCategory")),
            weekdays: data.getAll("weekdays").map(String),
            effectiveFrom: String(data.get("effectiveFrom")),
            startLocalTime: String(data.get("startLocalTime")),
            endLocalTime: String(data.get("endLocalTime")),
            zoneId: "Asia/Ho_Chi_Minh",
            activityPlaceRef: String(data.get("activityPlaceRef")),
            usualOriginRef: String(data.get("usualOriginRef")),
            arrivalBufferMinutes: Number(data.get("arrivalBufferMinutes")),
            directions: data.getAll("directions").map(String),
            defaultTravelRole: String(data.get("defaultTravelRole")),
            visibility: String(data.get("visibility")),
          } as RuleRequest);
        }}
      >
        <section className="form-section">
          <div className="form-section-heading">
            <span>
              <MapPinned aria-hidden="true" size={19} />
            </span>
            <div>
              <p>Bước 1</p>
              <h2>Hoạt động & địa điểm</h2>
              <small>Đặt tên dễ nhớ và chọn hai đầu hành trình.</small>
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <Input label="Tên lịch" name="name" required maxLength={80} />
            <label className="dike-field">
              <span>Loại hoạt động</span>
              <select name="activityCategory">
                <option value="WORK">Công việc</option>
                <option value="STUDY">Học tập</option>
                <option value="OTHER">Khác</option>
              </select>
            </label>
            <Input
              label="Mã địa điểm xuất phát"
              name="usualOriginRef"
              required
            />
            <Input
              label="Mã địa điểm hoạt động"
              name="activityPlaceRef"
              required
            />
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-heading">
            <span>
              <CalendarDays aria-hidden="true" size={19} />
            </span>
            <div>
              <p>Bước 2</p>
              <h2>Ngày lặp lại</h2>
              <small>Chọn ngày bắt đầu và các ngày thường di chuyển.</small>
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <Input
              label="Ngày bắt đầu"
              name="effectiveFrom"
              type="date"
              required
            />
            <fieldset className="weekday-picker">
              <legend>Ngày trong tuần</legend>
              <div>
                {weekdays.map(([value, label]) => (
                  <label key={value}>
                    <input type="checkbox" name="weekdays" value={value} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-heading">
            <span>
              <Clock3 aria-hidden="true" size={19} />
            </span>
            <div>
              <p>Bước 3</p>
              <h2>Khung giờ</h2>
              <small>Thời gian hoạt động và khoảng đệm khi đến nơi.</small>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <Input
              label="Giờ bắt đầu"
              name="startLocalTime"
              type="time"
              required
            />
            <Input
              label="Giờ kết thúc"
              name="endLocalTime"
              type="time"
              required
            />
            <Input
              label="Thời gian đệm (phút)"
              name="arrivalBufferMinutes"
              type="number"
              min={0}
              max={180}
              defaultValue={15}
            />
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-heading">
            <span>
              <Settings2 aria-hidden="true" size={19} />
            </span>
            <div>
              <p>Bước 4</p>
              <h2>Tùy chọn di chuyển</h2>
              <small>Chọn chiều đi, vai trò và phạm vi chia sẻ.</small>
            </div>
          </div>
          <div className="form-grid form-grid--three">
            <fieldset className="choice-fieldset">
              <legend>Chiều di chuyển</legend>
              <label>
                <input
                  type="checkbox"
                  name="directions"
                  value="OUTBOUND"
                  defaultChecked
                />{" "}
                Đi
              </label>
              <label>
                <input type="checkbox" name="directions" value="RETURN" /> Về
              </label>
            </fieldset>
            <label className="dike-field">
              <span>Vai trò</span>
              <select name="defaultTravelRole">
                <option value="PASSENGER">Hành khách</option>
                <option value="DRIVER">Tài xế</option>
              </select>
            </label>
            <label className="dike-field">
              <span>Quyền xem</span>
              <select name="visibility">
                <option value="PRIVATE">Riêng tư</option>
                <option value="FRIENDS">Bạn bè</option>
              </select>
            </label>
          </div>
        </section>
        {create.isError ? <p role="alert">{create.error.message}</p> : null}
        <div className="form-submit-row">
          <p>Lịch trình được lưu riêng tư theo lựa chọn của bạn.</p>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Đang tạo…" : "Tạo lịch"}
          </Button>
        </div>
      </form>
    </main>
  );
}
