import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import type { ScheduleResponse } from "@dike/api-client-ts";

import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorText,
  Icon,
  RouteCard,
  Text,
  ui,
} from "@/components/ui";
import { useResource, useMobileApi, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";

const days: Record<string, string> = {
  MONDAY: "T2",
  TUESDAY: "T3",
  WEDNESDAY: "T4",
  THURSDAY: "T5",
  FRIDAY: "T6",
  SATURDAY: "T7",
  SUNDAY: "CN",
};

export default function Schedules() {
  const api = useMobileApi();
  const query = useResource<ScheduleResponse[]>("schedules", "/schedules");
  const [target, setTarget] = useState<{
    s: ScheduleResponse;
    action: string;
  }>();
  const change = useMutation({
    mutationFn: () =>
      api.call(
        `/schedules/${target!.s.id}${target!.action === "end" ? "" : `/${target!.action}`}`,
        target!.action === "end" ? "DELETE" : "POST",
        undefined,
        undefined,
        { "If-Match": String(target!.s.version) },
      ),
    onSuccess: () => {
      setTarget(undefined);
      void query.refetch();
    },
  });
  const activeCount =
    query.data?.filter((schedule) => schedule.status !== "ENDED").length ?? 0;

  return (
    <DetailPage
      title="Lịch trình"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>Lịch thường xuyên</Text>
          <Text style={styles.summaryText}>
            {activeCount
              ? `${activeCount} lịch đang hoạt động`
              : "Sắp xếp những chuyến đi lặp lại"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tạo lịch trình"
          onPress={() => router.push("/schedules/edit")}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Icon name="add" size={22} color="#fff" />
          <Text style={styles.addText}>Tạo lịch</Text>
        </Pressable>
      </View>

      <ResourceState query={query}>
        {query.data?.length === 0 ? (
          <EmptyState
            title="Chưa có lịch trình"
            description="Thêm lịch học hoặc lịch làm việc để bắt đầu."
          />
        ) : (
          <View style={styles.list}>
            {query.data?.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onAction={(action) => setTarget({ s: schedule, action })}
              />
            ))}
          </View>
        )}
      </ResourceState>

      <BottomSheet
        visible={!!target}
        title={
          target?.action === "end"
            ? "Kết thúc lịch trình?"
            : target?.action === "resume"
              ? "Tiếp tục lịch trình?"
              : "Tạm dừng lịch trình?"
        }
        onClose={() => setTarget(undefined)}
      >
        <Text style={ui.muted}>{target?.s.name}</Text>
        <ErrorText error={change.error} />
        <Button
          label="Xác nhận"
          pending={change.isPending}
          onPress={() => change.mutate()}
        />
      </BottomSheet>
    </DetailPage>
  );
}

function ScheduleCard({
  schedule,
  onAction,
}: {
  schedule: ScheduleResponse;
  onAction: (action: string) => void;
}) {
  const ended = schedule.status === "ENDED";
  const paused = schedule.status === "PAUSED";
  return (
    <View style={[styles.card, ended && styles.cardEnded]}>
      <View style={styles.cardHeader}>
        <View style={styles.calendarIcon}>
          <Icon
            name="calendar-outline"
            size={21}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.cardHeading}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {schedule.name}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                paused && styles.statusPaused,
                ended && styles.statusEnded,
              ]}
            />
            <Text style={styles.statusText}>
              {statusLabel(schedule.status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.weekdays}>
        {Object.entries(days).map(([value, label]) => {
          const selected = schedule.weekdays.includes(value);
          return (
            <View
              key={value}
              style={[styles.day, selected && styles.daySelected]}
            >
              <Text
                style={[styles.dayText, selected && styles.dayTextSelected]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <RouteCard
        origin={schedule.usualOrigin.displayLabel}
        destination={schedule.activityPlace.displayLabel}
      />

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Icon name="time-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.metaValue}>
            {schedule.startLocalTime.slice(0, 5)} –{" "}
            {schedule.endLocalTime.slice(0, 5)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon
            name="calendar-clear-outline"
            size={18}
            color={theme.colors.primary}
          />
          <Text numberOfLines={1} style={styles.metaValue}>
            {schedule.effectiveUntil || "Không giới hạn"}
          </Text>
        </View>
      </View>

      {schedule.warnings?.length ? (
        <View style={styles.warning}>
          <Icon name="alert-circle-outline" size={17} color="#9a6b12" />
          <Text style={styles.warningText}>
            {schedule.warnings.length} cảnh báo trùng lịch
          </Text>
        </View>
      ) : null}

      {!ended ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/schedules/edit",
                params: { id: schedule.id },
              })
            }
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="create-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.actionText}>Chỉnh sửa</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAction(paused ? "resume" : "pause")}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={paused ? "play-outline" : "pause-outline"}
              size={19}
              color={theme.colors.primary}
            />
            <Text style={styles.actionText}>
              {paused ? "Tiếp tục" : "Tạm dừng"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kết thúc lịch trình"
            onPress={() => onAction("end")}
            style={({ pressed }) => [
              styles.endButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="trash-outline"
              size={19}
              color={theme.colors.inkMuted}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: "800" },
  summaryText: { color: theme.colors.inkMuted, fontSize: 13 },
  addButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 22,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  addText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  list: { gap: 14 },
  card: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  cardEnded: { opacity: 0.68 },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 11 },
  calendarIcon: {
    alignItems: "center",
    backgroundColor: "#e9f7f1",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  cardHeading: { flex: 1, gap: 4 },
  cardTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: "800" },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  statusDot: {
    backgroundColor: "#16a36f",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusPaused: { backgroundColor: theme.colors.passenger },
  statusEnded: { backgroundColor: "#91a39c" },
  statusText: { color: theme.colors.inkMuted, fontSize: 12, fontWeight: "600" },
  weekdays: { flexDirection: "row", gap: 6 },
  day: {
    alignItems: "center",
    backgroundColor: "#f0f5f2",
    borderRadius: 12,
    flex: 1,
    height: 34,
    justifyContent: "center",
  },
  daySelected: { backgroundColor: theme.colors.primary },
  dayText: { color: theme.colors.inkMuted, fontSize: 11, fontWeight: "700" },
  dayTextSelected: { color: "#fff" },
  metaGrid: { flexDirection: "row", gap: 8 },
  metaItem: {
    alignItems: "center",
    backgroundColor: "#f0f8f4",
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 11,
  },
  metaValue: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  warning: {
    alignItems: "center",
    backgroundColor: theme.colors.passengerSoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: 7,
    padding: 10,
  },
  warningText: { color: "#7c5a16", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8 },
  actionButton: {
    alignItems: "center",
    backgroundColor: "#edf7f3",
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 46,
  },
  actionText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800" },
  endButton: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  pressed: { opacity: 0.72 },
});
