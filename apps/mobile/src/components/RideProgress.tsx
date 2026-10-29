import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PaymentAcknowledgement,
  RidePayment,
  RidePostResponse,
} from "@dike/api-client-ts";
import { BottomSheet, Button, ErrorText, Icon, Text } from "./ui";
import { money, useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";

const PRICE_PER_KM_VND = 2_000;
const steps = [
  { status: "ACCEPTED", label: "Đã xác nhận", icon: "checkmark" as const },
  { status: "DRIVER_STARTED", label: "Đang đến đón", icon: "play" as const },
  {
    status: "DRIVER_ARRIVED",
    label: "Đã đến điểm đón",
    icon: "location" as const,
  },
  { status: "COMPLETED", label: "Hoàn thành", icon: "navigate" as const },
  { status: "PAYMENT", label: "Thanh toán", icon: "card-outline" as const },
] as const;
const nextStatus: Record<string, { status: string; label: string }> = {
  ACCEPTED: { status: "DRIVER_STARTED", label: "Bắt đầu đi" },
  DRIVER_STARTED: { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón" },
  DRIVER_ARRIVED: { status: "COMPLETED", label: "Hoàn thành chuyến" },
};
type PaymentMethod = "CASH" | "BANK";

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
  const client = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const driverId =
    response.action === "REQUEST_RIDE"
      ? response.ownerId
      : response.requesterId;
  const passengerId =
    response.action === "REQUEST_RIDE"
      ? response.requesterId
      : response.ownerId;
  const driver = currentUserId === driverId;
  const passenger = currentUserId === passengerId;
  const activeIndex = steps.findIndex(
    (step) => step.status === response.status,
  );
  const next = nextStatus[response.status];
  const cashPayment = useQuery({
    queryKey: ["mobile-cash-payment", response.id],
    queryFn: () =>
      api.call<PaymentAcknowledgement>(
        `/bookings/${encodeURIComponent(response.id)}/payment-acknowledgement`,
      ),
    enabled: response.status === "COMPLETED",
    retry: false,
    refetchInterval: response.status === "COMPLETED" ? 5_000 : false,
  });
  const bankPayment = useQuery({
    queryKey: ["mobile-bank-payment", response.id],
    queryFn: () =>
      api.call<RidePayment>(
        `/bookings/${encodeURIComponent(response.id)}/payment`,
      ),
    enabled: response.status === "COMPLETED",
    retry: false,
    refetchInterval: response.status === "COMPLETED" ? 5_000 : false,
  });
  const acknowledge = useMutation({
    mutationFn: (kind: "paid" | "received") =>
      api.call<PaymentAcknowledgement>(
        `/bookings/${encodeURIComponent(response.id)}/payment-acknowledgement/${kind}`,
        "PUT",
      ),
    onSuccess: async () => {
      setPaymentOpen(false);
      setConfirming(false);
      await Promise.all([
        client.invalidateQueries({
          queryKey: ["mobile-cash-payment", response.id],
        }),
        client.invalidateQueries({
          queryKey: ["mobile-bank-payment", response.id],
        }),
      ]);
    },
  });
  const paid =
    paymentComplete ||
    Boolean(cashPayment.data?.locked || bankPayment.data?.bankVerified);
  const passengerReportedPaid = Boolean(
    cashPayment.data?.passengerPaidAt || bankPayment.data?.bankVerified,
  );
  const amountVnd =
    cashPayment.data?.amountVnd ?? bankPayment.data?.amountVnd ?? 0;
  const distanceKm = amountVnd / PRICE_PER_KM_VND;
  const closePayment = () => {
    if (acknowledge.isPending) return;
    setPaymentOpen(false);
    setConfirming(false);
  };

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
              : passengerReportedPaid
                ? "Chờ xác nhận"
                : "Chờ thanh toán"
            : steps[Math.max(0, activeIndex)]?.label}
        </Text>
      </View>
      <View style={styles.steps}>
        {steps.map((step, index) => {
          const complete =
            step.status === "PAYMENT" ? paid : activeIndex >= index;
          return (
            <View key={step.status} style={styles.step}>
              {index > 0 ? (
                <View
                  style={[styles.lineBefore, complete && styles.lineComplete]}
                />
              ) : null}
              <View style={[styles.circle, complete && styles.circleComplete]}>
                <Icon
                  name={step.icon}
                  size={13}
                  color={complete ? "#fff" : theme.colors.inkMuted}
                />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.stepLabel, complete && styles.stepLabelComplete]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
      {driver && next ? (
        <Button
          label={next.label}
          icon="arrow-forward"
          onPress={() => onAdvance(next.status)}
        />
      ) : !driver && response.status !== "COMPLETED" ? (
        <Notice
          icon="notifications-outline"
          text="Bạn sẽ nhận thông báo khi người chở cập nhật hành trình."
        />
      ) : response.status === "COMPLETED" && !paid ? (
        <>
          {passenger && !passengerReportedPaid ? (
            <View style={styles.centerAction}>
              <Button
                label="Thanh toán"
                icon="card-outline"
                onPress={() => setPaymentOpen(true)}
              />
            </View>
          ) : driver && passengerReportedPaid ? (
            <View style={styles.centerAction}>
              <Button
                label="Đã nhận"
                icon="checkmark-circle-outline"
                pending={acknowledge.isPending}
                onPress={() => acknowledge.mutate("received")}
              />
            </View>
          ) : (
            <Notice
              icon="time-outline"
              text={
                driver
                  ? "Đang chờ người đi ké xác nhận thanh toán."
                  : "Đã xác nhận thanh toán. Đang chờ người chở bấm “Đã nhận”."
              }
            />
          )}
          <ErrorText error={acknowledge.error} />
        </>
      ) : response.status === "COMPLETED" ? (
        <View style={styles.successNotice}>
          <Icon name="checkmark-circle" size={17} color="#087d61" />
          <Text style={styles.successText}>
            Hai bên đã hoàn tất thanh toán.
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={paymentOpen}
        title={
          confirming ? "Xác nhận thanh toán" : "Chọn phương thức thanh toán"
        }
        onClose={closePayment}
      >
        {confirming ? (
          <View style={styles.paymentConfirm}>
            <View style={styles.confirmBanner}>
              <Icon
                name={method === "CASH" ? "cash-outline" : "business-outline"}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.confirmBannerTitle}>
                  {method === "CASH"
                    ? "Thanh toán tiền mặt"
                    : "Thanh toán chuyển khoản"}
                </Text>
                <Text style={styles.confirmBannerText}>
                  {method === "CASH"
                    ? "Thanh toán trực tiếp cho người chở."
                    : "Chuyển khoản cho người chở theo thông tin hai bên thống nhất."}
                </Text>
              </View>
            </View>
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Số tiền cần thanh toán</Text>
              <Text style={styles.amount}>{money(amountVnd)}</Text>
              <Text style={styles.amountHint}>
                {distanceKm.toLocaleString("vi-VN", {
                  maximumFractionDigits: 2,
                })}{" "}
                km × {money(PRICE_PER_KM_VND)}/km
              </Text>
            </View>
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>Hướng dẫn thanh toán</Text>
              <Text style={styles.guideText}>
                1. Kiểm tra đúng quãng đường và số tiền.
              </Text>
              <Text style={styles.guideText}>
                2.{" "}
                {method === "CASH"
                  ? "Trả tiền trực tiếp cho người chở."
                  : "Hoàn tất chuyển khoản cho người chở."}
              </Text>
              <Text style={styles.guideText}>
                3. Bấm xác nhận và chờ người chở bấm “Đã nhận”.
              </Text>
            </View>
            <ErrorText error={acknowledge.error} />
            <Button
              label={
                method === "CASH"
                  ? "Xác nhận đã thanh toán tiền mặt"
                  : "Xác nhận đã chuyển khoản"
              }
              icon="checkmark-circle-outline"
              pending={acknowledge.isPending}
              disabled={amountVnd <= 0}
              onPress={() => acknowledge.mutate("paid")}
            />
            <Button
              label="Quay lại"
              variant="secondary"
              disabled={acknowledge.isPending}
              onPress={() => setConfirming(false)}
            />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <Text style={styles.sheetDescription}>
              Vui lòng chọn cách thanh toán cho chuyến đi này.
            </Text>
            <PaymentMethodCard
              icon="cash-outline"
              title="Tiền mặt"
              description="Thanh toán trực tiếp cho người đồng hành"
              selected={method === "CASH"}
              onPress={() => setMethod("CASH")}
            />
            <PaymentMethodCard
              icon="business-outline"
              title="Chuyển khoản"
              description="Thanh toán qua tài khoản ngân hàng"
              selected={method === "BANK"}
              onPress={() => setMethod("BANK")}
            />
            <Button
              label="Tiếp tục"
              icon="arrow-forward"
              onPress={() => setConfirming(true)}
            />
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

function Notice({
  icon,
  text,
}: {
  icon: "notifications-outline" | "time-outline";
  text: string;
}) {
  return (
    <View style={styles.notice}>
      <Icon name={icon} size={16} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function PaymentMethodCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: "cash-outline" | "business-outline";
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.methodCard,
        selected && styles.methodCardSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.methodIcon}>
        <Icon name={icon} size={29} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.methodTitle}>{title}</Text>
        <Text style={styles.methodDescription}>{description}</Text>
      </View>
      <Icon
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={24}
        color={selected ? theme.colors.primary : "#b9cec5"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderColor: "#cfe9df",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 12,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  current: { color: theme.colors.primary, fontSize: 11, fontWeight: "800" },
  steps: { flexDirection: "row", alignItems: "flex-start" },
  step: { flex: 1, alignItems: "center", position: "relative", gap: 6 },
  lineBefore: {
    position: "absolute",
    right: "50%",
    top: 14,
    width: "100%",
    height: 2,
    backgroundColor: "#cbd8d3",
  },
  lineComplete: { backgroundColor: theme.colors.primary },
  circle: {
    zIndex: 1,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#cbd8d3",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  circleComplete: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  stepLabel: {
    minHeight: 24,
    paddingHorizontal: 1,
    color: theme.colors.inkMuted,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  stepLabelComplete: { color: theme.colors.primary, fontWeight: "800" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#f2f8f5",
    padding: 10,
  },
  noticeText: {
    flex: 1,
    color: theme.colors.inkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  centerAction: { alignSelf: "center", minWidth: 190 },
  successNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#e7f5ef",
    padding: 10,
  },
  successText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800" },
  sheetDescription: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  methodCard: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  methodCardSelected: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#fbfffd",
  },
  methodIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eaf7f1",
  },
  methodTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: "800" },
  methodDescription: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  paymentConfirm: { gap: 14 },
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#edf8f3",
  },
  confirmBannerTitle: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  confirmBannerText: {
    color: theme.colors.inkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  amountCard: {
    alignItems: "center",
    gap: 5,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#eef8f4",
  },
  amountLabel: { color: theme.colors.ink, fontSize: 12, fontWeight: "800" },
  amount: { color: theme.colors.ink, fontSize: 28, fontWeight: "900" },
  amountHint: { color: theme.colors.inkMuted, fontSize: 11 },
  guideCard: {
    gap: 7,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#f0f8ff",
  },
  guideTitle: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  guideText: { color: theme.colors.inkMuted, fontSize: 11, lineHeight: 16 },
});
