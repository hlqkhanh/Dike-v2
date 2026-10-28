import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type {
  PaymentAcknowledgement,
  RidePayment,
  RidePostResponse,
} from "@dike/api-client-ts";
import { Button, Icon, Text } from "./ui";
import { useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";

const steps = [
  { status: "ACCEPTED", label: "Đã xác nhận", icon: "checkmark" as const },
  { status: "DRIVER_STARTED", label: "Đang đến đón", icon: "play" as const },
  { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón", icon: "location" as const },
  { status: "COMPLETED", label: "Hoàn thành", icon: "navigate" as const },
  { status: "PAYMENT", label: "Thanh toán", icon: "card-outline" as const },
] as const;

const nextStatus: Record<string, { status: string; label: string }> = {
  ACCEPTED: { status: "DRIVER_STARTED", label: "Bắt đầu đi" },
  DRIVER_STARTED: { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón" },
  DRIVER_ARRIVED: { status: "COMPLETED", label: "Hoàn thành chuyến" },
};

export function RideProgress({
  response,
  currentUserId,
  paymentComplete = false,
  onAdvance,
}: {
  response: RidePostResponse;
  currentUserId?: string;
  paymentComplete?: boolean;
  onAdvance: (status: string) => void;
}) {
  const api = useMobileApi();
  const driverId = response.action === "REQUEST_RIDE" ? response.ownerId : response.requesterId;
  const driver = currentUserId === driverId;
  const activeIndex = steps.findIndex((step) => step.status === response.status);
  const next = nextStatus[response.status];
  const cashPayment = useQuery({
    queryKey: ["mobile-cash-payment", response.id],
    queryFn: () =>
      api.call<PaymentAcknowledgement>(
        `/bookings/${encodeURIComponent(response.id)}/payment-acknowledgement`,
      ),
    enabled: response.status === "COMPLETED",
    retry: false,
  });
  const bankPayment = useQuery({
    queryKey: ["mobile-bank-payment", response.id],
    queryFn: () =>
      api.call<RidePayment>(
        `/bookings/${encodeURIComponent(response.id)}/payment`,
      ),
    enabled: response.status === "COMPLETED",
    retry: false,
  });
  const paid =
    paymentComplete ||
    Boolean(cashPayment.data?.locked || bankPayment.data?.bankVerified);

  return (
    <View style={styles.shell} accessibilityLabel="Tiến độ chuyến đi">
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Icon name="git-branch-outline" size={17} />
          <Text style={styles.title}>Tiến độ chuyến đi</Text>
        </View>
        <Text style={styles.current}>
          {response.status === "COMPLETED"
            ? paid
              ? "Đã thanh toán"
              : "Chờ thanh toán"
            : steps[Math.max(0, activeIndex)]?.label}
        </Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step, index) => {
          const complete = step.status === "PAYMENT" ? paid : activeIndex >= index;
          return (
            <View key={step.status} style={styles.step}>
              {index > 0 ? <View style={[styles.lineBefore, complete && styles.lineComplete]} /> : null}
              <View style={[styles.circle, complete && styles.circleComplete]}>
                <Icon name={step.icon} size={13} color={complete ? "#fff" : theme.colors.inkMuted} />
              </View>
              <Text numberOfLines={2} style={[styles.stepLabel, complete && styles.stepLabelComplete]}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      {driver && next ? (
        <Button label={next.label} icon="arrow-forward" onPress={() => onAdvance(next.status)} />
      ) : !driver && response.status !== "COMPLETED" ? (
        <View style={styles.notice}>
          <Icon name="notifications-outline" size={16} />
          <Text style={styles.noticeText}>Bạn sẽ nhận thông báo khi người chở cập nhật hành trình.</Text>
        </View>
      ) : response.status === "COMPLETED" && !paid ? (
        <View style={styles.notice}>
          <Icon name="card-outline" size={16} />
          <Text style={styles.noticeText}>Chuyến đi đã hoàn thành và đang chờ thanh toán.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderColor: "#cfe9df", borderRadius: 18, backgroundColor: "#f1faf6", padding: 12, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  current: { color: theme.colors.primary, fontSize: 11, fontWeight: "800" },
  steps: { flexDirection: "row", alignItems: "flex-start" },
  step: { flex: 1, alignItems: "center", position: "relative", gap: 6 },
  lineBefore: { position: "absolute", right: "50%", top: 14, width: "100%", height: 2, backgroundColor: "#cbd8d3" },
  lineComplete: { backgroundColor: theme.colors.primary },
  circle: { zIndex: 1, width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "#cbd8d3", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  circleComplete: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  stepLabel: { minHeight: 24, paddingHorizontal: 1, color: theme.colors.inkMuted, fontSize: 8, lineHeight: 11, fontWeight: "600", textAlign: "center" },
  stepLabelComplete: { color: theme.colors.primary, fontWeight: "800" },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "#e7f5ef", padding: 10 },
  noticeText: { flex: 1, color: theme.colors.inkMuted, fontSize: 11, lineHeight: 16 },
});
