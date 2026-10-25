import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { BookingPage } from "@dike/api-client-ts";
import { Screen } from "@/components/Screen";
import { ResourceState } from "@/components/ResourceState";
import { JourneyTicket } from "@/components/JourneyTicket";
import { ArtEmptyState } from "@/components/ArtEmptyState";
import { Button, Chip, Text, ui } from "@/components/ui";
import { useMobileApi, dateTime, money, statusLabel } from "@/core/hooks";

const completed = ["COMPLETED", "CANCELLED", "NO_SHOW", "ENDED_EARLY"];
const active = ["BOARDED", "IN_PROGRESS", "DRIVER_ARRIVED"];

export default function Bookings() {
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
  const rows =
    query.data?.pages
      .flatMap((page) => page.items)
      .filter((booking) =>
        tab === "past"
          ? completed.includes(booking.status)
          : tab === "active"
            ? active.includes(booking.status)
            : !completed.includes(booking.status) &&
              !active.includes(booking.status),
      ) ?? [];

  return (
    <Screen
      title="Booking"
      subtitle="Những chuyến đã ghép và đặt chỗ của bạn."
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={ui.wrap}>
        {(
          [
            ["upcoming", "Sắp tới"],
            ["active", "Đang đi"],
            ["past", "Đã kết thúc"],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </View>
      <ResourceState query={query}>
        {rows.map((booking) => (
          <JourneyTicket
            key={booking.id}
            status={statusLabel(booking.status)}
            label="Chuyến đã kết nối"
          >
            <Text style={ui.sectionTitle}>
              Đón lúc {dateTime(booking.pickupAt)}
            </Text>
            <Text style={ui.muted}>Chi phí {money(booking.priceVnd)}</Text>
            <Button
              label="Xem booking"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/booking/[id]",
                  params: { id: booking.id },
                })
              }
            />
          </JourneyTicket>
        ))}
      </ResourceState>
      {!query.isLoading && !query.isError && !rows.length ? (
        <ArtEmptyState
          title="Chưa có booking ở đây"
          description="Các chuyến đã ghép và đặt chỗ sẽ xuất hiện tại đây."
          action="Khám phá hành trình"
          onPress={() => router.push("/(tabs)")}
        />
      ) : null}
      {query.hasNextPage ? (
        <Button
          label="Tải thêm booking"
          variant="secondary"
          pending={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}
