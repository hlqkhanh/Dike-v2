"use client";

import type { RuleRequest } from "@dike/api-client-ts";
import { Button, Input } from "@dike/web-ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { scheduleApi } from "../../../src/schedules/api";

const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

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
    <main className="settings-page">
      <h1>Tạo lịch trình</h1>
      <p>Chọn địa điểm trên bản đồ trước để lấy mã tham chiếu còn hiệu lực.</p>
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
        <Input label="Tên lịch" name="name" required maxLength={80} />
        <Input label="Mã địa điểm xuất phát" name="usualOriginRef" required />
        <Input label="Mã địa điểm hoạt động" name="activityPlaceRef" required />
        <Input label="Ngày bắt đầu" name="effectiveFrom" type="date" required />
        <Input label="Giờ bắt đầu" name="startLocalTime" type="time" required />
        <Input label="Giờ kết thúc" name="endLocalTime" type="time" required />
        <Input
          label="Thời gian đệm (phút)"
          name="arrivalBufferMinutes"
          type="number"
          min={0}
          max={180}
          defaultValue={15}
        />
        <label className="dike-field">
          <span>Loại hoạt động</span>
          <select name="activityCategory">
            <option value="WORK">Công việc</option>
            <option value="STUDY">Học tập</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <fieldset>
          <legend>Ngày trong tuần</legend>
          {weekdays.map((day) => (
            <label key={day}>
              <input type="checkbox" name="weekdays" value={day} /> {day}
            </label>
          ))}
        </fieldset>
        <fieldset>
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
        {create.isError ? <p role="alert">{create.error.message}</p> : null}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Đang tạo…" : "Tạo lịch"}
        </Button>
      </form>
    </main>
  );
}
