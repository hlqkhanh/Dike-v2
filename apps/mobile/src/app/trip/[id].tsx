import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { TripStops, TripView } from "@dike/api-client-ts";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { JourneyTicket } from "@/components/JourneyTicket";
import {
  BottomSheet,
  Button,
  Card,
  ErrorText,
  Field,
  Icon,
  RouteCard,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function Trip() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const api = useMobileApi();
  const client = useQueryClient();
  const { session } = useSession();
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const trip = useQuery({
    queryKey: ["mobile-trip", id],
    queryFn: () => api.trip(id),
    refetchInterval: 10000,
  });
  const stops = useQuery({
    queryKey: ["mobile-trip-stops", id],
    queryFn: () => api.call<TripStops>(`/trips/${id}/stops`),
    refetchInterval: 10000,
  });
  const change = useMutation({
    mutationFn: () =>
      api.call<TripView>(
        `/trips/${id}/${action === "open" ? "open" : "actions"}`,
        "POST",
        action === "open"
          ? { version: trip.data!.version }
          : { version: trip.data!.version, action, reason },
        randomUUID(),
      ),
    onSuccess: () => {
      setAction("");
      void trip.refetch();
      void client.invalidateQueries({ queryKey: ["mobile-trips"] });
    },
  });
  const t = trip.data;
  const own = t?.driverId === session?.user.id;
  const stage =
    t?.status === "COMPLETED"
      ? 3
      : t?.status === "IN_PROGRESS"
        ? 2
        : ["OPEN", "FULL"].includes(t?.status || "")
          ? 1
          : 0;
  return (
    <DetailPage
      title="Chi tiết chuyến đi"
      subtitle="Mỗi bước đều được cập nhật"
      art="route"
      onRefresh={() => {
        void trip.refetch();
        void stops.refetch();
      }}
      refreshing={trip.isRefetching}
    >
      <ResourceState query={trip}>
        {t ? (
          <>
            <JourneyTicket
              status={statusLabel(t.status)}
              label={own ? "Chuyến của bạn" : "Hành trình cùng đi"}
            >
              <RouteCard
                origin={t.originLabel}
                destination={t.destinationLabel}
              />
              <Text style={ui.muted}>
                {dateTime(t.departureAt)} ·{" "}
                {t.vehicleType === "CAR" ? "Ô tô" : "Xe máy"} ·{" "}
                {t.remainingSeats} chỗ trống
              </Text>
            </JourneyTicket>
            <Card>
              <Text style={ui.sectionTitle}>Tiến trình chuyến đi</Text>
              {[
                "Đã tạo",
                "Mở nhận người đi",
                "Đang di chuyển",
                "Hoàn thành",
              ].map((label, i) => (
                <View key={label} style={[ui.row, { minHeight: 44 }]}>
                  <Icon
                    name={i <= stage ? "checkmark-circle" : "ellipse-outline"}
                    color={i <= stage ? "#087d61" : "#b4c9be"}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      color: i <= stage ? "#12342d" : "#8aa096",
                    }}
                  >
                    {label}
                  </Text>
                </View>
              ))}
              {["CANCELLED", "EXPIRED"].includes(t.status) ? (
                <Text style={ui.muted}>
                  Chuyến đã kết thúc: {statusLabel(t.status)}.
                </Text>
              ) : null}
            </Card>
            <ResourceState query={stops}>
              {stops.data?.items.map((s) => (
                <Card key={s.id}>
                  <View style={ui.row}>
                    <Icon name="location-outline" />
                    <Text style={[ui.sectionTitle, { fontSize: 16 }]}>
                      {s.kind === "PICKUP" ? "Đón khách" : "Trả khách"}
                    </Text>
                  </View>
                  <Text style={ui.muted}>
                    {s.publicLabel} · {dateTime(s.eta)}
                  </Text>
                  {s.bookingId ? (
                    <Button
                      label="Xem thành viên và kết nối"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/booking/[id]",
                          params: { id: s.bookingId },
                        })
                      }
                    />
                  ) : null}
                </Card>
              ))}
            </ResourceState>
            {own ? (
              <>
                <Text style={ui.sectionTitle}>Quản lý hành trình</Text>
                {t.status === "DRAFT" ? (
                  <Button label="Mở chuyến" onPress={() => setAction("open")} />
                ) : null}
                {["OPEN", "FULL"].includes(t.status) ? (
                  <Button
                    label="Bắt đầu chuyến"
                    disabled={
                      Date.now() < Date.parse(t.departureAt) - 15 * 60000
                    }
                    onPress={() => setAction("start")}
                  />
                ) : null}
                {t.status === "IN_PROGRESS" ? (
                  <Button
                    label="Hoàn thành chuyến"
                    onPress={() => setAction("complete")}
                  />
                ) : null}
                {["DRAFT", "OPEN", "FULL"].includes(t.status) ? (
                  <Button
                    label="Hủy chuyến"
                    variant="secondary"
                    onPress={() => setAction("cancel")}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </ResourceState>
      <BottomSheet
        visible={!!action}
        title="Xác nhận thay đổi chuyến"
        onClose={() => setAction("")}
      >
        <Text style={ui.muted}>
          Trạng thái được cập nhật cho các thành viên trong chuyến.
        </Text>
        {action === "cancel" ? (
          <Field
            label="Lý do hủy"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
          />
        ) : null}
        <ErrorText error={change.error} />
        <Button
          label="Xác nhận"
          pending={change.isPending}
          disabled={action === "cancel" && !reason.trim()}
          onPress={() => change.mutate()}
        />
      </BottomSheet>
    </DetailPage>
  );
}
