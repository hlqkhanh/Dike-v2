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
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { BookingPage, BookingView } from "@dike/api-client-ts";

import { ArtEmptyState } from "@/components/ArtEmptyState";
import { Button, Icon, Text } from "@/components/ui";
import { useMobileApi, money, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";
import { homeAssets } from "@/core/assets";

const completedStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW", "ENDED_EARLY"];
const activeStatuses = ["BOARDED", "IN_PROGRESS", "DRIVER_ARRIVED"];

const DAY_NAMES_VI = [
  "CHỦ NHẬT",
  "THỨ HAI",
  "THỨ BA",
  "THỨ TƯ",
  "THỨ NĂM",
  "THỨ SÁU",
  "THỨ BẢY",
];

function formatBookingDate(dateStr?: string) {
  if (!dateStr) {
    return {
      dayName: "HÔM NAY",
      dayNum: "01",
      monthStr: "THÁNG 1",
      timeStr: "00:00",
      dateStr: "",
      monthYear: "Tháng 10, 2026",
    };
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return {
      dayName: "HÔM NAY",
      dayNum: "01",
      monthStr: "THÁNG 1",
      timeStr: "00:00",
      dateStr: "",
      monthYear: "Tháng 10, 2026",
    };
  }

  const dayName = DAY_NAMES_VI[d.getDay()];
  const dayNum = String(d.getDate()).padStart(2, "0");
  const monthStr = `THÁNG ${d.getMonth() + 1}`;
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dateStrFormatted = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const monthYear = `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  return {
    dayName,
    dayNum,
    monthStr,
    timeStr,
    dateStr: dateStrFormatted,
    monthYear,
  };
}

function getBookingStatusConfig(status: string) {
  switch (status) {
    case "CONFIRMED":
    case "ACCEPTED":
      return {
        label: "✓ Đã xác nhận",
        bg: "#e8f7f0",
        color: "#0d8a68",
      };
    case "COMPLETED":
      return {
        label: "✓ Hoàn tất",
        bg: "#eef2ff",
        color: "#4f46e5",
      };
    case "IN_PROGRESS":
    case "DRIVER_ARRIVED":
    case "BOARDED":
      return {
        label: "Đang đi",
        bg: "#fffbeb",
        color: "#d97706",
      };
    case "CANCELLED":
    case "NO_SHOW":
    case "ENDED_EARLY":
      return {
        label: "Đã hủy",
        bg: "#fef2f2",
        color: "#ef4444",
      };
    default:
      return {
        label: statusLabel(status),
        bg: "#f1f5f9",
        color: "#64748b",
      };
  }
}

interface EnrichedBooking extends BookingView {
  sampleOrigin?: string;
  sampleDestination?: string;
}

const SAMPLE_BOOKINGS: EnrichedBooking[] = [
  {
    id: "sample-booking-1",
    tripId: "sample-trip-1",
    passengerId: "p1",
    driverId: "d1",
    status: "CONFIRMED",
    priceVnd: 32000,
    pickupAt: "2026-10-15T14:27:00.000Z",
    dropoffAt: "2026-10-15T15:07:00.000Z",
    reason: "",
    version: 1,
    sampleOrigin: "Đại học FPT Quy Nhơn, Bình Định",
    sampleDestination: "GO! Quy Nhơn, Bình Định",
  },
  {
    id: "sample-booking-2",
    tripId: "sample-trip-2",
    passengerId: "p1",
    driverId: "d1",
    status: "COMPLETED",
    priceVnd: 32000,
    pickupAt: "2026-10-13T10:27:00.000Z",
    dropoffAt: "2026-10-13T11:07:00.000Z",
    reason: "",
    version: 1,
    sampleOrigin: "Đại học FPT Quy Nhơn, Bình Định",
    sampleDestination: "GO! Quy Nhơn, Bình Định",
  },
];

export default function Bookings() {
  const insets = useSafeAreaInsets();
  const api = useMobileApi();
  const [tab, setTab] = useState<"upcoming" | "active" | "past">("upcoming");

  const query = useInfiniteQuery({
    queryKey: ["mobile-bookings"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.call<BookingPage>(
        `/bookings${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (page) => page.nextCursor || undefined,
  });

  const apiBookings = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const displayBookings: EnrichedBooking[] = useMemo(() => {
    const listToFilter = apiBookings.length > 0 ? apiBookings : SAMPLE_BOOKINGS;

    return listToFilter.filter((booking) => {
      if (tab === "past") return completedStatuses.includes(booking.status);
      if (tab === "active") return activeStatuses.includes(booking.status);
      return (
        !completedStatuses.includes(booking.status) &&
        !activeStatuses.includes(booking.status)
      );
    });
  }, [apiBookings, tab]);

  // Group by Month Year
  const groupedBookings = useMemo(() => {
    const groups: { monthYear: string; items: EnrichedBooking[] }[] = [];
    displayBookings.forEach((b) => {
      const { monthYear } = formatBookingDate(b.pickupAt);
      let g = groups.find((item) => item.monthYear === monthYear);
      if (!g) {
        g = { monthYear, items: [] };
        groups.push(g);
      }
      g.items.push(b);
    });
    return groups;
  }, [displayBookings]);

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
            refreshing={query.isRefetching && !query.isFetchingNextPage}
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
            onPress={() => router.push("/notifications")}
            style={styles.bellButton}
            accessibilityLabel="Thông báo"
          >
            <Icon name="notifications-outline" size={22} color="#0f172a" />
            <View style={styles.bellBadge} />
          </Pressable>
        </View>

        {/* Page Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Booking của tôi</Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.tabRow}>
          {[
            { key: "upcoming", label: "Sắp tới" },
            { key: "active", label: "Đang đi" },
            { key: "past", label: "Đã kết thúc" },
          ].map(({ key, label }) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key as typeof tab)}
                style={[
                  styles.tabPill,
                  active ? styles.tabPillActive : styles.tabPillInactive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    active
                      ? styles.tabPillTextActive
                      : styles.tabPillTextInactive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Grouped Bookings Content */}
        {groupedBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ArtEmptyState
              art="ticket"
              title="Chưa có booking nào"
              description="Các chuyến đã ghép và đặt chỗ của bạn sẽ xuất hiện tại đây."
              action="Khám phá hành trình"
              onPress={() => router.push("/(tabs)")}
            />
          </View>
        ) : (
          <View style={styles.listContainer}>
            {groupedBookings.map((group) => (
              <View key={group.monthYear} style={styles.monthGroup}>
                <Text style={styles.monthHeader}>{group.monthYear}</Text>
                {group.items.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    sampleOrigin={booking.sampleOrigin}
                    sampleDestination={booking.sampleDestination}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Pagination */}
        {query.hasNextPage ? (
          <View style={styles.loadMoreBox}>
            <Button
              label="Tải thêm booking"
              variant="secondary"
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BookingCard({
  booking,
  sampleOrigin,
  sampleDestination,
  samplePassengers,
}: {
  booking: EnrichedBooking;
  sampleOrigin?: string;
  sampleDestination?: string;
  samplePassengers?: number;
}) {
  const api = useMobileApi();
  const isSample = booking.id.startsWith("sample-");

  const tripQuery = useQuery({
    queryKey: ["mobile-trip", booking.tripId],
    queryFn: () => api.trip(booking.tripId),
    enabled: !isSample && !!booking.tripId,
  });

  const origin = isSample
    ? (sampleOrigin ?? "Đại học FPT Quy Nhơn, Bình Định")
    : (tripQuery.data?.originLabel ?? "Điểm đón đã xác nhận");

  const destination = isSample
    ? (sampleDestination ?? "GO! Quy Nhơn, Bình Định")
    : (tripQuery.data?.destinationLabel ?? "Điểm trả đã xác nhận");

  const pickupInfo = formatBookingDate(booking.pickupAt);
  const dropoffInfo = formatBookingDate(booking.dropoffAt);
  const statusConfig = getBookingStatusConfig(booking.status);

  return (
    <Pressable
      onPress={() => {
        if (!isSample) {
          router.push({
            pathname: "/booking/[id]",
            params: { id: booking.id },
          });
        }
      }}
      style={({ pressed }) => [
        styles.bookingCard,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Top Details Row */}
      <View style={styles.cardTopRow}>
        {/* Date Box on Left */}
        <View style={styles.dateBlock}>
          <Text style={styles.dateDayName}>{pickupInfo.dayName}</Text>
          <Text style={styles.dateDayNum}>{pickupInfo.dayNum}</Text>
          <Text style={styles.dateMonth}>{pickupInfo.monthStr}</Text>
        </View>

        {/* Info on Right */}
        <View style={styles.cardInfoCol}>
          {/* Booking Title & Status Badge */}
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={1} style={styles.cardTitleText}>
              Booking lúc {pickupInfo.timeStr} {pickupInfo.dateStr}
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}
            >
              <Text
                style={[styles.statusBadgeText, { color: statusConfig.color }]}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Route Details */}
          <View style={styles.routeSection}>
            {/* Pickup Stop */}
            <View style={styles.routeStopRow}>
              <View style={styles.bullseyeOuter}>
                <View style={styles.bullseyeInner} />
              </View>
              <Text style={styles.stopActionText}>Đón</Text>
              <Text style={styles.stopTimeText}>{pickupInfo.timeStr}</Text>
              <Text style={styles.stopDivider}>|</Text>
              <Text numberOfLines={1} style={styles.stopLocationText}>
                {origin}
              </Text>
            </View>

            {/* Dotted Vertical Connector */}
            <View style={styles.routeConnectorLine} />

            {/* Dropoff Stop */}
            <View style={styles.routeStopRow}>
              <View style={styles.ringOuter} />
              <Text style={styles.stopActionText}>Trả</Text>
              <Text style={styles.stopTimeText}>{dropoffInfo.timeStr}</Text>
              <Text style={styles.stopDivider}>|</Text>
              <Text numberOfLines={1} style={styles.stopLocationText}>
                {destination}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Divider Line */}
      <View style={styles.cardDivider} />

      {/* Bottom Footer */}
      <View style={styles.cardFooterRow}>
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>Tổng chi phí</Text>
          <Text style={styles.footerPriceText}>{money(booking.priceVnd)}</Text>
        </View>

        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>Số người</Text>
          <Text style={styles.footerPassText}>
            {samplePassengers ?? 1} người
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (!isSample) {
              router.push({
                pathname: "/booking/[id]",
                params: { id: booking.id },
              });
            }
          }}
          style={({ pressed }) => [
            styles.detailButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.detailButtonText}>Xem chi tiết</Text>
          <Icon name="chevron-forward" size={14} color="#0d8a68" />
        </Pressable>
      </View>
    </Pressable>
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
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  titleSection: {
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 19,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: "#0d8a68",
    ...theme.shadow.card,
  },
  tabPillInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabPillText: {
    fontSize: 13.5,
  },
  tabPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  tabPillTextInactive: {
    color: "#0f172a",
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  monthGroup: {
    marginBottom: 10,
  },
  monthHeader: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  bookingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#edf2ee",
    padding: 16,
    marginBottom: 14,
    ...theme.shadow.card,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dateBlock: {
    backgroundColor: "#e8f7f0",
    borderRadius: 16,
    width: 74,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDayName: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0d8a68",
    letterSpacing: 0.4,
  },
  dateDayNum: {
    fontSize: 27,
    fontWeight: "900",
    color: "#0d8a68",
    lineHeight: 32,
    marginVertical: 1,
  },
  dateMonth: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0d8a68",
    letterSpacing: 0.4,
  },
  cardInfoCol: {
    flex: 1,
    marginStart: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cardTitleText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  routeSection: {
    marginTop: 10,
    gap: 3,
  },
  routeStopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bullseyeOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#0d8a68",
    alignItems: "center",
    justifyContent: "center",
  },
  bullseyeInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#0d8a68",
  },
  ringOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#10b981",
  },
  stopActionText: {
    fontSize: 12,
    color: "#64748b",
    marginStart: 6,
    marginEnd: 4,
    fontWeight: "500",
  },
  stopTimeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    marginEnd: 6,
  },
  stopDivider: {
    fontSize: 12,
    color: "#cbd5e1",
    marginEnd: 6,
  },
  stopLocationText: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  routeConnectorLine: {
    width: 1,
    height: 12,
    borderStyle: "dotted",
    borderLeftWidth: 1.5,
    borderColor: "#cbd5e1",
    marginStart: 6,
    marginVertical: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerCol: {
    gap: 2,
  },
  footerLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  footerPriceText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  footerPassText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  detailButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#0d8a68",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  detailButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0d8a68",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  loadMoreBox: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
});
