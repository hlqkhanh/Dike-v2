import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PlaceResponse, ScheduleResponse } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { PlacePicker } from "@/components/PlacePicker";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
const weekdays = [
  ["MONDAY", "T2"],
  ["TUESDAY", "T3"],
  ["WEDNESDAY", "T4"],
  ["THURSDAY", "T5"],
  ["FRIDAY", "T6"],
  ["SATURDAY", "T7"],
  ["SUNDAY", "CN"],
];
export default function ScheduleEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const api = useMobileApi();
  const query = useQuery({
    queryKey: ["mobile-schedule", id],
    queryFn: () => api.call<ScheduleResponse>(`/schedules/${id}`),
    enabled: !!id,
  });
  return (
    <DetailPage
      title={id ? "Chỉnh sửa lịch trình" : "Lịch trình mới"}
      subtitle="Lên lịch cho những hành trình quen thuộc"
      art="schedule"
    >
      {id ? (
        <ResourceState query={query}>
          {query.data ? <Editor data={query.data} /> : null}
        </ResourceState>
      ) : (
        <Editor />
      )}
    </DetailPage>
  );
}
function Editor({ data }: { data?: ScheduleResponse }) {
  const api = useMobileApi();
  const [name, setName] = useState(data?.name || "");
  const [category, setCategory] = useState(data?.activityCategory || "STUDY");
  const [days, setDays] = useState<string[]>(
    data?.weekdays || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  );
  const [from, setFrom] = useState(
    data?.effectiveFrom || new Date().toLocaleDateString("en-CA"),
  );
  const [until, setUntil] = useState(data?.effectiveUntil || "");
  const [start, setStart] = useState(
    data?.startLocalTime.slice(0, 5) || "08:00",
  );
  const [end, setEnd] = useState(data?.endLocalTime.slice(0, 5) || "17:00");
  const [origin, setOrigin] = useState<PlaceResponse>();
  const [destination, setDestination] = useState<PlaceResponse>();
  const [role, setRole] = useState(data?.defaultTravelRole || "RIDER");
  const [visibility, setVisibility] = useState(data?.visibility || "PRIVATE");
  const [directions, setDirections] = useState(
    data?.directions || ["OUTBOUND", "RETURN"],
  );
  const save = useMutation({
    mutationFn: async () => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/u.test(from) ||
        !Number.isFinite(Date.parse(from)) ||
        (until && (!/^\d{4}-\d{2}-\d{2}$/u.test(until) || until < from))
      )
        throw new Error(
          "Ngày bắt đầu và kết thúc phải hợp lệ, dạng YYYY-MM-DD.",
        );
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/u.test(start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/u.test(end) ||
        end <= start
      )
        throw new Error("Giờ kết thúc phải sau giờ bắt đầu, dạng HH:mm.");
      return api.call<ScheduleResponse>(
        data ? `/schedules/${data.id}` : "/schedules",
        data ? "PUT" : "POST",
        {
          name: name.trim(),
          activityCategory: category,
          weekdays: days,
          effectiveFrom: from,
          effectiveUntil: until || null,
          startLocalTime: start,
          endLocalTime: end,
          zoneId: "Asia/Ho_Chi_Minh",
          activityPlaceRef: destination!.placeRef,
          usualOriginRef: origin!.placeRef,
          arrivalBufferMinutes: 15,
          directions,
          defaultTravelRole: role,
          visibility,
        },
        undefined,
        data ? { "If-Match": String(data.version) } : undefined,
      );
    },
    onSuccess: () => router.replace("/schedules"),
  });
  return (
    <>
      <Card>
        <Text style={ui.eyebrow}>01 · LỊCH TRÌNH CỦA BẠN</Text>
        <Field
          label="Tên lịch trình"
          value={name}
          onChangeText={setName}
          maxLength={80}
        />
        <View style={ui.wrap}>
          {[
            ["STUDY", "Đi học"],
            ["WORK", "Đi làm"],
            ["OTHER", "Khác"],
          ].map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              selected={category === v}
              onPress={() => setCategory(v)}
            />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={ui.eyebrow}>02 · NGÀY VÀ THỜI GIAN</Text>
        <Text style={ui.label}>Ngày trong tuần</Text>
        <View style={ui.wrap}>
          {weekdays.map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              selected={days.includes(v)}
              onPress={() =>
                setDays(
                  days.includes(v) ? days.filter((d) => d !== v) : [...days, v],
                )
              }
            />
          ))}
        </View>
        <Field
          label="Bắt đầu (YYYY-MM-DD)"
          value={from}
          onChangeText={setFrom}
        />
        <Field
          label="Kết thúc (tùy chọn)"
          value={until}
          onChangeText={setUntil}
          placeholder="YYYY-MM-DD"
        />
        <Field
          label="Giờ bắt đầu (HH:mm)"
          value={start}
          onChangeText={setStart}
        />
        <Field label="Giờ kết thúc (HH:mm)" value={end} onChangeText={setEnd} />
      </Card>
      <Card>
        <Text style={ui.eyebrow}>03 · TUYẾN ĐƯỜNG VÀ VAI TRÒ</Text>
        {data ? (
          <Text style={ui.muted}>
            Tìm và chọn lại hai địa điểm để xác nhận tuyến khi chỉnh sửa.
          </Text>
        ) : null}
        <PlacePicker
          label="Điểm xuất phát thường xuyên"
          value={origin}
          onChange={setOrigin}
        />
        <PlacePicker
          label="Nơi học hoặc làm việc"
          value={destination}
          onChange={setDestination}
        />
        <Text style={ui.label}>Chiều di chuyển</Text>
        <View style={ui.wrap}>
          {[
            ["OUTBOUND", "Chiều đi"],
            ["RETURN", "Chiều về"],
          ].map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              selected={directions.includes(v)}
              onPress={() =>
                setDirections(
                  directions.includes(v)
                    ? directions.filter((d) => d !== v)
                    : [...directions, v],
                )
              }
            />
          ))}
        </View>
        <View style={ui.wrap}>
          {[
            ["RIDER", "Đi ké"],
            ["DRIVER", "Tôi chở"],
          ].map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              selected={role === v}
              onPress={() => setRole(v)}
            />
          ))}
        </View>
        <View style={ui.wrap}>
          {[
            ["PRIVATE", "Riêng tư"],
            ["FRIENDS", "Bạn bè"],
          ].map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              selected={visibility === v}
              onPress={() => setVisibility(v)}
            />
          ))}
        </View>
      </Card>
      <Card style={{ backgroundColor: "#edf8f1" }}>
        <Text style={ui.sectionTitle}>Xem lại lịch trình</Text>
        <Text style={ui.muted}>
          {name.trim() || "Lịch trình của bạn"} · {days.length} ngày/tuần
        </Text>
        <Text style={ui.muted}>
          {start} – {end} · {role === "DRIVER" ? "Tôi chở" : "Đi ké"}
        </Text>
        <ErrorText error={save.error} />
        <Button
          label="Lưu lịch trình"
          pending={save.isPending}
          disabled={
            !name.trim() ||
            !days.length ||
            !directions.length ||
            !origin ||
            !destination
          }
          onPress={() => save.mutate()}
        />
      </Card>
    </>
  );
}
