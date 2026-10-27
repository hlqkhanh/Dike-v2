import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import type { ScheduleResponse } from "@dike/api-client-ts";

import { ResourceState } from "@/components/ResourceState";
import {
  BottomSheet,
  Button,
  EmptyState,
  ErrorText,
  Icon,
  Text,
  ui,
} from "@/components/ui";
import { useResource, useMobileApi, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";
import { homeAssets } from "@/core/assets";

const days: Record<string, string> = {
  MONDAY: "T2",
  TUESDAY: "T3",
  WEDNESDAY: "T4",
  THURSDAY: "T5",
  FRIDAY: "T6",
  SATURDAY: "T7",
  SUNDAY: "CN",
};

const dayNamesVi = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const dayOfWeekKeys = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

interface TimelineTrip {
  id: string;
  time: string;
  type: "Lượt đi" | "Lượt về";
  origin: string;
  destination: string;
  scheduleId?: string;
}

interface TimelineDateGroup {
  dateKey: string;
  dayName: string;
  dayNum: string;
  monthStr: string;
  monthYearStr: string;
  trips: TimelineTrip[];
}

export default function Schedules() {
  const insets = useSafeAreaInsets();
  const api = useMobileApi();
  const query = useResource<ScheduleResponse[]>("schedules", "/schedules");
  const [activeTab, setActiveTab] = useState<"upcoming" | "recurring">(
    "upcoming",
  );
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

  const schedules = query.data ?? [];
  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.status !== "ENDED"),
    [schedules],
  );
  const recurringCount = activeSchedules.length;

  // Generate upcoming occurrences from active schedules
  const { upcomingGroups, totalUpcomingCount, currentMonthHeader } =
    useMemo(() => {
      const today = new Date();
      const groups: TimelineDateGroup[] = [];
      let count = 0;

      if (activeSchedules.length > 0) {
        // Generate next 14 calendar days
        for (let i = 0; i < 14 && count < 30; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dayKey = dayOfWeekKeys[d.getDay()];

          const matching = activeSchedules.filter((s) =>
            s.weekdays.includes(dayKey),
          );

          if (matching.length === 0) continue;

          const trips: TimelineTrip[] = [];
          matching.forEach((s) => {
            const hasOutbound = s.directions.includes("OUTBOUND");
            const hasInbound = s.directions.includes("INBOUND");

            if (hasOutbound) {
              trips.push({
                id: `${s.id}-${d.toISOString()}-out`,
                time: `${s.startLocalTime.slice(0, 5)} → ${s.endLocalTime.slice(0, 5)}`,
                type: "Lượt đi",
                origin: s.usualOrigin.displayLabel,
                destination: s.activityPlace.displayLabel,
                scheduleId: s.id,
              });
              count++;
            }

            if (hasInbound) {
              trips.push({
                id: `${s.id}-${d.toISOString()}-in`,
                time: `10:30 → 20:30`,
                type: "Lượt về",
                origin: s.activityPlace.displayLabel,
                destination: s.usualOrigin.displayLabel,
                scheduleId: s.id,
              });
              count++;
            }
          });

          if (trips.length > 0) {
            groups.push({
              dateKey: d.toISOString(),
              dayName: dayNamesVi[d.getDay()],
              dayNum: String(d.getDate()).padStart(2, "0"),
              monthStr: `Tháng ${d.getMonth() + 1}`,
              monthYearStr: `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`,
              trips,
            });
          }
        }
      }

      // Default mock data preview if user has no schedules yet
      if (groups.length === 0) {
        const sampleMonthYear = `Tháng ${today.getMonth() + 1}, ${today.getFullYear()}`;
        const sampleDays = [
          { dayName: "Thứ Hai", dayNum: "26" },
          { dayName: "Thứ Ba", dayNum: "27" },
          { dayName: "Thứ Tư", dayNum: "28" },
        ];

        sampleDays.forEach((sd, idx) => {
          groups.push({
            dateKey: `sample-${idx}`,
            dayName: sd.dayName,
            dayNum: sd.dayNum,
            monthStr: `Tháng ${today.getMonth() + 1}`,
            monthYearStr: sampleMonthYear,
            trips: [
              {
                id: `sample-${idx}-1`,
                time: "07:30 → 17:30",
                type: "Lượt đi",
                origin: "Nhà riêng · Hà Đông, Hà Nội",
                destination: "Keangnam Landmark 72, Nam Từ Liêm, Hà Nội",
              },
              {
                id: `sample-${idx}-2`,
                time: "10:30 → 20:30",
                type: "Lượt về",
                origin: "Keangnam Landmark 72, Nam Từ Liêm, Hà Nội",
                destination: "Nhà riêng · Hà Đông, Hà Nội",
              },
            ],
          });
        });
        count = 20;
      }

      const firstMonth =
        groups[0]?.monthYearStr ??
        `Tháng ${today.getMonth() + 1}, ${today.getFullYear()}`;

      return {
        upcomingGroups: groups,
        totalUpcomingCount: count,
        currentMonthHeader: firstMonth,
      };
    }, [activeSchedules]);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.safeTop} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Top Navigation Row */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel="Quay lại"
            >
              <Icon name="chevron-back" size={24} color="#0f172a" />
            </Pressable>
            <Image
              source={homeAssets.logo}
              resizeMode="contain"
              style={styles.logo}
            />
            <Text style={styles.brandTitle}>Diké</Text>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.avatarCircle}
            accessibilityLabel="Tài khoản cá nhân"
          >
            <Icon name="person" size={20} color="#64748b" />
          </Pressable>
        </View>

        {/* Tab Switcher & Action Button */}
        <View style={styles.controlRow}>
          {/* Segmented Pills */}
          <View style={styles.tabPillContainer}>
            <Pressable
              onPress={() => setActiveTab("upcoming")}
              style={[
                styles.tabPill,
                activeTab === "upcoming" && styles.tabPillActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "upcoming" }}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "upcoming" && styles.tabPillTextActive,
                ]}
              >
                Sắp tới
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "upcoming" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "upcoming" && styles.tabBadgeTextActive,
                  ]}
                >
                  {totalUpcomingCount}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("recurring")}
              style={[
                styles.tabPill,
                activeTab === "recurring" && styles.tabPillActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "recurring" }}
            >
              <Text
                style={[
                  styles.tabPillText,
                  activeTab === "recurring" && styles.tabPillTextActive,
                ]}
              >
                Lịch định kỳ
              </Text>
              <View
                style={[
                  styles.tabBadge,
                  activeTab === "recurring" && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === "recurring" && styles.tabBadgeTextActive,
                  ]}
                >
                  {recurringCount || 1}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* + Tạo lịch trình Action Button */}
          <Pressable
            onPress={() => router.push("/schedules/edit")}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Tạo lịch trình mới"
          >
            <Icon name="add" size={18} color="#ffffff" />
            <Text style={styles.createButtonText}>Tạo lịch trình</Text>
          </Pressable>
        </View>

        {/* TAB 1: SẮP TỚI (Timeline View) */}
        {activeTab === "upcoming" ? (
          <View style={styles.timelineSection}>
            <Text style={styles.monthSectionHeader}>{currentMonthHeader}</Text>

            {upcomingGroups.map((group) => (
              <View key={group.dateKey} style={styles.timelineGroupRow}>
                {/* Left Date Column */}
                <View style={styles.dateColumn}>
                  <Text style={styles.dateDayName}>{group.dayName}</Text>
                  <Text style={styles.dateDayNum}>{group.dayNum}</Text>
                  <Text style={styles.dateMonth}>{group.monthStr}</Text>
                </View>

                {/* Timeline Rail with Node Dot */}
                <View style={styles.timelineRail}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineLine} />
                </View>

                {/* Right Trip Cards */}
                <View style={styles.tripCardsColumn}>
                  {group.trips.map((trip) => (
                    <Pressable
                      key={trip.id}
                      onPress={() => {
                        if (trip.scheduleId) {
                          router.push({
                            pathname: "/schedules/edit",
                            params: { id: trip.scheduleId },
                          });
                        }
                      }}
                      style={({ pressed }) => [
                        styles.tripCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      {/* Top Time and Badge Row */}
                      <View style={styles.tripTopRow}>
                        <View style={styles.timeCluster}>
                          <Text style={styles.timeRangeText}>{trip.time}</Text>
                          <View
                            style={[
                              styles.directionBadge,
                              trip.type === "Lượt đi"
                                ? styles.outboundBadge
                                : styles.inboundBadge,
                            ]}
                          >
                            <Text
                              style={[
                                styles.directionBadgeText,
                                trip.type === "Lượt đi"
                                  ? styles.outboundText
                                  : styles.inboundText,
                              ]}
                            >
                              {trip.type}
                            </Text>
                          </View>
                        </View>
                        <Icon
                          name="chevron-forward"
                          size={17}
                          color="#94a3b8"
                        />
                      </View>

                      {/* Route Details */}
                      <View style={styles.tripRouteBox}>
                        <View style={styles.routeItem}>
                          <View style={styles.greenOriginDot} />
                          <Text numberOfLines={1} style={styles.routeLabel}>
                            {trip.origin}
                          </Text>
                        </View>

                        <View style={styles.verticalDottedLine} />

                        <View style={styles.routeItem}>
                          <Icon name="location" size={13} color="#d97706" />
                          <Text numberOfLines={1} style={styles.routeLabel}>
                            {trip.destination}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          /* TAB 2: LỊCH ĐỊNH KỲ (Recurring Rules List) */
          <View style={styles.recurringSection}>
            <ResourceState query={query}>
              {schedules.length === 0 ? (
                <EmptyState
                  title="Chưa có lịch trình định kỳ"
                  description="Thêm lịch học hoặc làm việc cố định để bắt đầu ghép chuyến tự động."
                />
              ) : (
                <View style={styles.recurringList}>
                  {schedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onAction={(action) => setTarget({ s: schedule, action })}
                    />
                  ))}
                </View>
              )}
            </ResourceState>
          </View>
        )}
      </ScrollView>

      {/* Confirmation BottomSheet for recurring rules */}
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
    </View>
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
  const hasOutbound = schedule.directions.includes("OUTBOUND");
  const hasInbound = schedule.directions.includes("INBOUND");

  return (
    <View style={[styles.recurringCard, ended && styles.cardEnded]}>
      {/* Top Header: Schedule Name & Status Badge */}
      <View style={styles.recurringTopRow}>
        <View style={styles.recurringTitleCluster}>
          <Text numberOfLines={1} style={styles.recurringTitle}>
            {schedule.name}
          </Text>
          <View style={styles.badgeCluster}>
            {hasOutbound ? (
              <View style={[styles.directionBadge, styles.outboundBadge]}>
                <Text style={[styles.directionBadgeText, styles.outboundText]}>
                  Lượt đi
                </Text>
              </View>
            ) : null}
            {hasInbound ? (
              <View style={[styles.directionBadge, styles.inboundBadge]}>
                <Text style={[styles.directionBadgeText, styles.inboundText]}>
                  Lượt về
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            paused && styles.statusPillPaused,
            ended && styles.statusPillEnded,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              paused && styles.statusPaused,
              ended && styles.statusEnded,
            ]}
          />
          <Text
            style={[
              styles.statusPillText,
              paused && styles.statusPillTextPaused,
              ended && styles.statusPillTextEnded,
            ]}
          >
            {statusLabel(schedule.status)}
          </Text>
        </View>
      </View>

      {/* Time & Period Info */}
      <View style={styles.recurringTimeRow}>
        <View style={styles.timeCluster}>
          <Icon name="time-outline" size={15} color="#0d8a68" />
          <Text style={styles.timeRangeText}>
            {schedule.startLocalTime.slice(0, 5)} →{" "}
            {schedule.endLocalTime.slice(0, 5)}
          </Text>
        </View>
        <Text style={styles.effectiveText}>
          {schedule.effectiveUntil
            ? `Đến ${schedule.effectiveUntil}`
            : "Lặp lại vô hạn"}
        </Text>
      </View>

      {/* Weekday Selector Pills */}
      <View style={styles.weekdaysRow}>
        {Object.entries(days).map(([value, label]) => {
          const selected = schedule.weekdays.includes(value);
          return (
            <View
              key={value}
              style={[styles.weekdayChip, selected && styles.weekdayChipActive]}
            >
              <Text
                style={[
                  styles.weekdayChipText,
                  selected && styles.weekdayChipTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Route Info matching Tab 1 */}
      <View style={styles.tripRouteBox}>
        <View style={styles.routeItem}>
          <View style={styles.greenOriginDot} />
          <Text numberOfLines={1} style={styles.routeLabel}>
            {schedule.usualOrigin.displayLabel}
          </Text>
        </View>

        <View style={styles.verticalDottedLine} />

        <View style={styles.routeItem}>
          <Icon name="location" size={13} color="#d97706" />
          <Text numberOfLines={1} style={styles.routeLabel}>
            {schedule.activityPlace.displayLabel}
          </Text>
        </View>
      </View>

      {/* Action Row */}
      {!ended ? (
        <View style={styles.recurringActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/schedules/edit",
                params: { id: schedule.id },
              })
            }
            style={({ pressed }) => [
              styles.actionPill,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="create-outline" size={15} color="#0d8a68" />
            <Text style={styles.actionPillText}>Chỉnh sửa</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onAction(paused ? "resume" : "pause")}
            style={({ pressed }) => [
              styles.actionPill,
              paused && styles.actionPillResume,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={paused ? "play-outline" : "pause-outline"}
              size={15}
              color={paused ? "#2563eb" : "#d97706"}
            />
            <Text
              style={[
                styles.actionPillText,
                paused && { color: "#2563eb" },
                !paused && { color: "#d97706" },
              ]}
            >
              {paused ? "Tiếp tục" : "Tạm dừng"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kết thúc lịch trình"
            onPress={() => onAction("end")}
            style={({ pressed }) => [
              styles.actionPillEnd,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="trash-outline" size={15} color="#ef4444" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  safeTop: {
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 2,
  },
  logo: {
    width: 30,
    height: 30,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  tabPillContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 26,
    padding: 3,
    gap: 4,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 22,
  },
  tabPillActive: {
    backgroundColor: "#ffffff",
    ...theme.shadow.card,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  tabPillTextActive: {
    color: "#0d8a68",
    fontWeight: "800",
  },
  tabBadge: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeActive: {
    backgroundColor: "#0d8a68",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  tabBadgeTextActive: {
    color: "#ffffff",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0d8a68",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...theme.shadow.card,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  monthSectionHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 14,
  },
  timelineSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  timelineGroupRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dateColumn: {
    width: 62,
    alignItems: "flex-start",
    paddingTop: 4,
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  dateDayNum: {
    fontSize: 25,
    fontWeight: "900",
    color: "#0d8a68",
    lineHeight: 30,
    marginVertical: 1,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94a3b8",
  },
  timelineRail: {
    width: 22,
    alignItems: "center",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginTop: 10,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#ccebe1",
    marginTop: 4,
  },
  tripCardsColumn: {
    flex: 1,
    paddingBottom: 8,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eef2ef",
    padding: 13,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  tripTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  timeCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeRangeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  directionBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outboundBadge: {
    backgroundColor: "#e8f7f0",
  },
  inboundBadge: {
    backgroundColor: "#e8f2ff",
  },
  directionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  outboundText: {
    color: "#0d8a68",
  },
  inboundText: {
    color: "#2563eb",
  },
  tripRouteBox: {
    gap: 4,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  greenOriginDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginStart: 2,
  },
  verticalDottedLine: {
    width: 1,
    height: 10,
    borderStyle: "dotted",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginStart: 5,
    marginVertical: 1,
  },
  routeLabel: {
    flex: 1,
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  recurringSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  recurringList: {
    gap: 14,
  },
  recurringCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eef2ef",
    padding: 14,
    gap: 12,
    ...theme.shadow.card,
  },
  cardEnded: { opacity: 0.62 },
  recurringTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  recurringTitleCluster: {
    flex: 1,
    gap: 6,
  },
  recurringTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  badgeCluster: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e8f7f0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillPaused: {
    backgroundColor: "#fff7ed",
  },
  statusPillEnded: {
    backgroundColor: "#f1f5f9",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0d8a68",
  },
  statusPillTextPaused: {
    color: "#d97706",
  },
  statusPillTextEnded: {
    color: "#64748b",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  statusPaused: { backgroundColor: "#f59e0b" },
  statusEnded: { backgroundColor: "#94a3b8" },
  recurringTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  effectiveText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  weekdaysRow: {
    flexDirection: "row",
    gap: 5,
  },
  weekdayChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 30,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  weekdayChipActive: {
    backgroundColor: "#0d8a68",
  },
  weekdayChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
  },
  weekdayChipTextActive: {
    color: "#ffffff",
  },
  recurringActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#e8f7f0",
  },
  actionPillResume: {
    backgroundColor: "#eff6ff",
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0d8a68",
  },
  actionPillEnd: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#fef2f2",
  },
  pressed: { opacity: 0.72 },
});
