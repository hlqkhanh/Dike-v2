import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type {
  BookingView,
  BoardingCode,
  ReviewEligibility,
} from "@dike/api-client-ts";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { JourneyTicket } from "@/components/JourneyTicket";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime, money, statusLabel } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function Booking() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const api = useMobileApi();
  const client = useQueryClient();
  const { session } = useSession();
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const query = useQuery({
    queryKey: ["mobile-booking", id],
    queryFn: () => api.call<BookingView>(`/bookings/${id}`),
    refetchInterval: 10000,
  });
  const b = query.data;
  const driver = b?.driverId === session?.user.id;
  const active = [
    "CONFIRMED",
    "DRIVER_ARRIVED",
    "BOARDED",
    "IN_PROGRESS",
  ].includes(b?.status || "");
  const boarding = useQuery({
    queryKey: ["mobile-boarding", id],
    queryFn: () => api.call<BoardingCode>(`/bookings/${id}/boarding-code`),
    enabled:
      !!b && !driver && ["CONFIRMED", "DRIVER_ARRIVED"].includes(b.status),
  });
  const eligible = useQuery({
    queryKey: ["mobile-review-eligible", id],
    queryFn: () =>
      api.call<ReviewEligibility>(`/bookings/${id}/review-eligibility`),
    enabled: b?.status === "COMPLETED",
  });
  const change = useMutation({
    mutationFn: () =>
      api.call(
        `/bookings/${id}/actions`,
        "POST",
        { version: b!.version, action, reason, code },
        randomUUID(),
      ),
    onSuccess: () => {
      setAction("");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["mobile-bookings"] });
    },
  });
  const review = useMutation({
    mutationFn: () =>
      api.call("/reviews", "POST", { bookingId: id, stars, comment }),
    onSuccess: () => void eligible.refetch(),
  });
  return (
    <DetailPage
      title="Kết nối chuyến đi"
      subtitle="An toàn và rõ ràng từng bước"
      art="ticket"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <ResourceState query={query}>
        {b ? (
          <>
            <JourneyTicket
              status={statusLabel(b.status)}
              label="Vé hành trình"
              passenger={!driver}
            >
              <Text style={ui.sectionTitle}>
                {driver ? "Bạn là người chở" : "Bạn là người đi ké"}
              </Text>
              <Text style={ui.muted}>Giờ đón: {dateTime(b.pickupAt)}</Text>
              <Text style={ui.muted}>Giờ trả: {dateTime(b.dropoffAt)}</Text>
              <View
                style={{
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: "#e2eee7",
                  gap: 6,
                }}
              >
                <Text style={ui.eyebrow}>CHI PHÍ CHIA SẺ</Text>
                <Text
                  style={{ fontSize: 30, fontWeight: "800", color: "#087d61" }}
                >
                  {money(b.priceVnd)}
                </Text>
              </View>
              <Button
                label="Xem tuyến đường"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/trip/[id]",
                    params: { id: b.tripId },
                  })
                }
              />
              <Button
                label="Hồ sơ người cùng đi"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/user/[id]",
                    params: { id: driver ? b.passengerId : b.driverId },
                  })
                }
              />
            </JourneyTicket>
            {boarding.data ? (
              <Card>
                <Text style={ui.sectionTitle}>Mã lên xe</Text>
                <Text
                  style={{ fontSize: 32, fontWeight: "800", letterSpacing: 6 }}
                >
                  {boarding.data.code}
                </Text>
                <Text style={ui.muted}>
                  Chỉ đưa mã cho tài xế khi bạn đã đến đúng xe.
                </Text>
              </Card>
            ) : null}
            {driver && b.status === "CONFIRMED" ? (
              <Button
                label="Đã đến điểm đón"
                onPress={() => setAction("ARRIVE")}
              />
            ) : null}
            {driver && ["CONFIRMED", "DRIVER_ARRIVED"].includes(b.status) ? (
              <Button
                label="Xác nhận lên xe"
                onPress={() => setAction("BOARD")}
              />
            ) : null}
            {driver && b.status === "IN_PROGRESS" ? (
              <Button
                label="Hoàn thành kết nối"
                onPress={() => setAction("COMPLETE")}
              />
            ) : null}
            {["CONFIRMED", "DRIVER_ARRIVED"].includes(b.status) ? (
              <Button
                label="Hủy kết nối"
                variant="secondary"
                onPress={() => setAction("CANCEL")}
              />
            ) : null}
            {active && ["BOARDED", "IN_PROGRESS"].includes(b.status) ? (
              <Button
                label="Kết thúc sớm"
                variant="secondary"
                onPress={() => setAction("END_EARLY")}
              />
            ) : null}
            {b.reason ? (
              <Card>
                <Text style={ui.muted}>{b.reason}</Text>
              </Card>
            ) : null}
            {eligible.data?.eligible ? (
              <Card>
                <Text style={ui.sectionTitle}>Hành trình của bạn thế nào?</Text>
                <View style={ui.wrap}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <Chip
                      key={v}
                      label={`${v} sao`}
                      selected={stars === v}
                      onPress={() => setStars(v)}
                    />
                  ))}
                </View>
                <Field
                  label="Chia sẻ trải nghiệm"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={1000}
                />
                <ErrorText error={review.error} />
                <Button
                  label="Gửi đánh giá"
                  pending={review.isPending}
                  onPress={() => review.mutate()}
                />
              </Card>
            ) : eligible.data?.submitted ? (
              <Badge label="Bạn đã gửi đánh giá" />
            ) : null}
          </>
        ) : null}
      </ResourceState>
      <BottomSheet
        visible={!!action}
        title="Xác nhận hành động"
        onClose={() => setAction("")}
      >
        <Text style={ui.muted}>Cập nhật này được gửi tới người cùng đi.</Text>
        {action === "BOARD" ? (
          <Field
            label="Mã lên xe từ hành khách"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
        ) : null}
        {["CANCEL", "END_EARLY"].includes(action) ? (
          <Field
            label="Lý do"
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
          disabled={
            (["CANCEL", "END_EARLY"].includes(action) && !reason.trim()) ||
            (action === "BOARD" && !code.trim())
          }
          onPress={() => change.mutate()}
        />
      </BottomSheet>
    </DetailPage>
  );
}
