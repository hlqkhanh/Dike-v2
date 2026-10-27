import { useCallback, useMemo, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type { RidePostInboxItem, RidePostInboxPage } from "@dike/api-client-ts";

import { ArtEmptyState } from "@/components/ArtEmptyState";
import {
  BottomSheet,
  Button,
  ErrorText,
  Icon,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, money, statusLabel } from "@/core/hooks";
import { theme } from "@/core/theme";
import { homeAssets } from "@/core/assets";

interface EnrichedRequest extends RidePostInboxItem {
  sampleOrigin?: string;
  sampleDestination?: string;
  samplePrice?: number;
  sampleDeparture?: string;
  sampleArrival?: string;
  sampleDeadline?: string;
}

const SAMPLE_REQUESTS: EnrichedRequest[] = [
  {
    id: "sample-req-1",
    postId: "sample-post-1",
    requesterId: "u1",
    requesterDisplayName: "Linh Ái",
    ownerId: "me",
    action: "REQUEST",
    status: "PENDING",
    message: "Chào bạn, cho mình đi cùng chuyến này nhé!",
    createdAt: "2026-10-14T21:27:00.000Z",
    updatedAt: "2026-10-14T21:27:00.000Z",
    version: 1,
    sampleOrigin: "Đại học FPT Quy Nhơn, Nhơn Bình, Quy Nhơn, Bình Định",
    sampleDestination: "GO! Quy Nhơn, Ghềnh Ráng, Quy Nhơn, Bình Định",
    sampleDeparture: "2026-10-15T04:27:00.000Z",
    sampleArrival: "2026-10-15T05:07:00.000Z",
    sampleDeadline: "12:27 15/10/2026",
    samplePrice: 32000,
  },
  {
    id: "sample-req-2",
    postId: "sample-post-2",
    requesterId: "u2",
    requesterDisplayName: "Trần Minh Đức",
    ownerId: "me",
    action: "REQUEST",
    status: "PENDING",
    message: "Mình có hành lý nhỏ, đi cùng được không ạ?",
    createdAt: "2026-10-14T07:27:00.000Z",
    updatedAt: "2026-10-14T07:27:00.000Z",
    version: 1,
    sampleOrigin: "Đại học FPT Quy Nhơn, Nhơn Bình, Quy Nhơn, Bình Định",
    sampleDestination: "GO! Quy Nhơn, Ghềnh Ráng, Quy Nhơn, Bình Định",
    sampleDeparture: "2026-10-15T14:27:00.000Z",
    sampleArrival: "2026-10-15T15:07:00.000Z",
    sampleDeadline: "12:27 15/10/2026",
    samplePrice: 32000,
  },
];

function formatDateTime(dateStr?: string) {
  if (!dateStr)
    return { time: "00:00", date: "15/10/2026", full: "00:00 15/10/2026" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime()))
    return { time: "00:00", date: "15/10/2026", full: "00:00 15/10/2026" };
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return { time, date, full: `${time} ${date}` };
}

function getRequestStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return {
        label: "○ Chờ xác nhận",
        bg: "#eff6ff",
        color: "#2563eb",
      };
    case "ACCEPTED":
      return {
        label: "✓ Đã chấp nhận",
        bg: "#e8f7f0",
        color: "#0d8a68",
      };
    case "REJECTED":
      return {
        label: "✕ Đã từ chối",
        bg: "#fef2f2",
        color: "#ef4444",
      };
    case "WITHDRAWN":
      return {
        label: "Đã rút lại",
        bg: "#f1f5f9",
        color: "#64748b",
      };
    default:
      return {
        label: statusLabel(status),
        bg: "#f1f5f9",
        color: "#64748b",
      };
  }
}

export default function Requests() {
  const insets = useSafeAreaInsets();
  const api = useMobileApi();
  const [direction, setDirection] = useState<"received" | "sent">("received");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [focused, setFocused] = useState(true);

  const [decisionTarget, setDecisionTarget] = useState<{
    item: EnrichedRequest;
    decision: "ACCEPTED" | "REJECTED";
  }>();

  const query = useInfiniteQuery({
    queryKey: ["mobile-response-inbox", direction],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.call<RidePostInboxPage>(
        `/ride-post-responses?direction=${direction}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (p) => p.nextCursor || undefined,
    enabled: focused,
    refetchInterval: focused ? 15000 : false,
  });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void query.refetch();
      return () => setFocused(false);
    }, [query.refetch]),
  );

  const decisionMutation = useMutation({
    mutationFn: () =>
      api.call(
        `/ride-post-responses/${decisionTarget!.item.id}/decision`,
        "POST",
        {
          version: decisionTarget!.item.version,
          decision: decisionTarget!.decision,
        },
      ),
    onSuccess: () => {
      setDecisionTarget(undefined);
      void query.refetch();
    },
  });

  const apiItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const displayList: EnrichedRequest[] = useMemo(() => {
    const base = apiItems.length > 0 ? apiItems : SAMPLE_REQUESTS;
    return base.filter((r) => {
      if (statusFilter === "ALL") return true;
      return r.status === statusFilter;
    });
  }, [apiItems, statusFilter]);

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
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Yêu cầu đi cùng</Text>
        </View>

        {/* Primary Segmented Tabs: Nhận được / Đã gửi */}
        <View style={styles.segmentedContainer}>
          <Pressable
            onPress={() => setDirection("received")}
            style={[
              styles.segmentPill,
              direction === "received" && styles.segmentPillActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                direction === "received" && styles.segmentTextActive,
              ]}
            >
              Nhận được
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setDirection("sent")}
            style={[
              styles.segmentPill,
              direction === "sent" && styles.segmentPillActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                direction === "sent" && styles.segmentTextActive,
              ]}
            >
              Đã gửi
            </Text>
          </Pressable>
        </View>

        {/* Secondary Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {[
            { key: "ALL", label: "Tất cả" },
            { key: "PENDING", label: "Chờ xác nhận" },
            { key: "ACCEPTED", label: "Đã chấp nhận" },
            { key: "REJECTED", label: "Đã từ chối" },
          ].map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setStatusFilter(key)}
                style={[
                  styles.filterChip,
                  active ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active
                      ? styles.filterChipTextActive
                      : styles.filterChipTextInactive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Request Cards List */}
        {displayList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ArtEmptyState
              art="conversation"
              title="Chưa có yêu cầu nào"
              description="Yêu cầu gửi từ bài đăng và phản hồi của bạn sẽ xuất hiện tại đây."
              action="Khám phá hành trình"
              onPress={() => router.push("/(tabs)")}
            />
          </View>
        ) : (
          <View style={styles.listSection}>
            {displayList.map((item) => (
              <RequestCard
                key={item.id}
                item={item}
                direction={direction}
                onDecision={(decision) => setDecisionTarget({ item, decision })}
              />
            ))}
          </View>
        )}

        {/* Pagination */}
        {query.hasNextPage ? (
          <View style={styles.loadMoreBox}>
            <Button
              label="Tải thêm yêu cầu"
              variant="secondary"
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Decision BottomSheet Confirmation */}
      <BottomSheet
        visible={!!decisionTarget}
        title={
          decisionTarget?.decision === "ACCEPTED"
            ? "Chấp nhận yêu cầu đi cùng?"
            : "Từ chối yêu cầu đi cùng?"
        }
        onClose={() => setDecisionTarget(undefined)}
      >
        <Text style={ui.muted}>
          {decisionTarget?.decision === "ACCEPTED"
            ? `Bạn có chắc muốn chấp nhận yêu cầu của ${decisionTarget?.item.requesterDisplayName}? Chuyến đi sẽ được kết nối.`
            : `Bạn có chắc muốn từ chối yêu cầu của ${decisionTarget?.item.requesterDisplayName}?`}
        </Text>
        <ErrorText error={decisionMutation.error} />
        <Button
          label="Xác nhận"
          variant={
            decisionTarget?.decision === "ACCEPTED" ? "primary" : "secondary"
          }
          pending={decisionMutation.isPending}
          onPress={() => decisionMutation.mutate()}
        />
      </BottomSheet>
    </View>
  );
}

function RequestCard({
  item,
  direction,
  onDecision,
}: {
  item: EnrichedRequest;
  direction: "received" | "sent";
  onDecision: (decision: "ACCEPTED" | "REJECTED") => void;
}) {
  const api = useMobileApi();
  const isSample = item.id.startsWith("sample-");

  const postQuery = useQuery({
    queryKey: ["mobile-post", item.postId],
    queryFn: () => api.post(item.postId),
    enabled: !isSample && !!item.postId,
    retry: false,
  });

  const post = postQuery.data;

  // Origin and destination labels
  const originLabel = isSample
    ? (item.sampleOrigin ??
      "Đại học FPT Quy Nhơn, Nhơn Bình, Quy Nhơn, Bình Định")
    : (post?.originLabel ?? "Điểm đón bài đăng");

  const destinationLabel = isSample
    ? (item.sampleDestination ??
      "GO! Quy Nhơn, Ghềnh Ráng, Quy Nhơn, Bình Định")
    : (post?.destinationLabel ?? "Điểm đến bài đăng");

  // Departure and arrival dates
  const departureDate = isSample
    ? (item.sampleDeparture ?? "2026-10-15T04:27:00.000Z")
    : (post?.departureAt ?? item.createdAt);

  const arrivalDate = isSample
    ? (item.sampleArrival ?? "2026-10-15T05:07:00.000Z")
    : post?.departureAt
      ? new Date(
          new Date(post.departureAt).getTime() + 40 * 60 * 1000,
        ).toISOString()
      : item.updatedAt;

  const depInfo = formatDateTime(departureDate);
  const arrInfo = formatDateTime(arrivalDate);
  const deadlineStr = isSample
    ? (item.sampleDeadline ?? "12:27 15/10/2026")
    : formatDateTime(item.updatedAt).full;

  const priceVal = isSample
    ? (item.samplePrice ?? 32000)
    : post?.contributionPerKm
      ? post.contributionPerKm * 15
      : 32000;

  const statusConfig = getRequestStatusBadge(item.status);
  const isPending = item.status === "PENDING";
  const canRespond = direction === "received" && isPending;

  return (
    <Pressable
      onPress={() => {
        if (!isSample) {
          router.push({
            pathname: "/posts/[id]",
            params: { id: item.postId, responseId: item.id },
          });
        }
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Top Header Row: User Name & Status Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.userNameBox}>
          <Text style={styles.userNameText}>
            {direction === "received"
              ? item.requesterDisplayName
              : (post?.ownerDisplayName ?? "Người đăng bài")}
          </Text>
          <Text style={styles.userSubText}>Yêu cầu đi cùng</Text>
        </View>

        <View style={styles.badgeCluster}>
          <View
            style={[
              styles.statusBadgePill,
              { backgroundColor: statusConfig.bg },
            ]}
          >
            <Text
              style={[styles.statusBadgeText, { color: statusConfig.color }]}
            >
              {statusConfig.label}
            </Text>
          </View>
          <Icon name="chevron-forward" size={17} color="#94a3b8" />
        </View>
      </View>

      {/* Route Details Box */}
      <View style={styles.routeBox}>
        {/* Left Track */}
        <View style={styles.routeTrack}>
          {/* Concentric Double Green Circle */}
          <View style={styles.concentricOuter}>
            <View style={styles.concentricInner} />
          </View>
          {/* Dashed Vertical Line */}
          <View style={styles.verticalDashedLine} />
          {/* Destination Orange Pin */}
          <Icon name="location" size={18} color="#d97706" />
        </View>

        {/* Right Stop Details */}
        <View style={styles.routeStops}>
          {/* Stop 1: Pickup */}
          <View style={styles.stopDetailItem}>
            <Text style={styles.stopTimeDateText}>{depInfo.full}</Text>
            <Text numberOfLines={1} style={styles.stopAddressText}>
              {originLabel}
            </Text>
          </View>

          {/* Stop 2: Dropoff */}
          <View style={[styles.stopDetailItem, { marginTop: 12 }]}>
            <Text style={styles.stopTimeDateText}>{arrInfo.full}</Text>
            <Text numberOfLines={1} style={styles.stopAddressText}>
              {destinationLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Meta Row: Mức đóng góp & Hạn xác nhận */}
      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Mức đóng góp</Text>
          <Text style={styles.metaPrice}>{money(priceVal)}</Text>
        </View>

        <View style={styles.metaColEnd}>
          <Text style={styles.metaLabel}>Hạn xác nhận</Text>
          <Text style={styles.metaDeadLine}>{deadlineStr}</Text>
        </View>
      </View>

      {/* Bottom Action Row (for received pending requests) */}
      {canRespond ? (
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDecision("REJECTED")}
            style={({ pressed }) => [
              styles.rejectButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Icon name="close" size={16} color="#ef4444" />
            <Text style={styles.rejectText}>Từ chối</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => onDecision("ACCEPTED")}
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Icon name="checkmark" size={16} color="#ffffff" />
            <Text style={styles.acceptText}>Chấp nhận</Text>
          </Pressable>
        </View>
      ) : null}
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
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 28,
    marginHorizontal: 16,
    marginTop: 18,
    padding: 3,
  },
  segmentPill: {
    flex: 1,
    height: 42,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentPillActive: {
    backgroundColor: "#0d8a68",
    ...theme.shadow.card,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  filterChipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#0d8a68",
    ...theme.shadow.card,
  },
  filterChipInactive: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipText: {
    fontSize: 13,
  },
  filterChipTextActive: {
    color: "#0d8a68",
    fontWeight: "800",
  },
  filterChipTextInactive: {
    color: "#64748b",
    fontWeight: "600",
  },
  listSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  card: {
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
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  userNameBox: {
    flex: 1,
    gap: 2,
  },
  userNameText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  userSubText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  badgeCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadgePill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  routeBox: {
    backgroundColor: "#f8faf9",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  routeTrack: {
    width: 20,
    alignItems: "center",
    paddingTop: 2,
  },
  concentricOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#0d8a68",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  concentricInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0d8a68",
  },
  verticalDashedLine: {
    width: 1.5,
    height: 26,
    borderStyle: "dashed",
    borderLeftWidth: 1.5,
    borderColor: "#cbd5e1",
    marginVertical: 2,
  },
  routeStops: {
    flex: 1,
  },
  stopDetailItem: {
    gap: 3,
  },
  stopTimeDateText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  stopAddressText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 14,
  },
  metaCol: {
    gap: 2,
  },
  metaColEnd: {
    gap: 2,
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  metaPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  metaDeadLine: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  rejectButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rejectText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#ef4444",
  },
  acceptButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#0d8a68",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...theme.shadow.card,
  },
  acceptText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#ffffff",
  },
  buttonPressed: {
    opacity: 0.82,
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
