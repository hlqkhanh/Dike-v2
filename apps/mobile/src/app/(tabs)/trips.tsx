import type { BookingView, TripView } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, sharedStyles } from "@/components/Screen";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Trips() {
  const { token } = useSession();
  const query = useQuery({
    queryKey: ["mobile-trips"],
    queryFn: async () => {
      const api = createMobileApi(() => Promise.resolve(token));
      const [trips, bookings] = await Promise.all([
        api.trips(),
        api.bookings(),
      ]);
      return { trips: trips.items, bookings: bookings.items };
    },
    refetchInterval: 15_000,
  });
  const trips = query.data?.trips ?? [];
  const bookings = query.data?.bookings ?? [];
  return (
    <Screen
      loading={query.isLoading}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="Theo dõi hành trình bạn đã tạo và tham gia"
      title="Chuyến đi"
    >
      <View style={styles.stats}>
        <Stat label="Đã đăng" value={trips.length} />
        <Stat label="Đang tham gia" value={bookings.length} />
      </View>
      {query.isError ? (
        <Text accessibilityRole="alert" style={sharedStyles.empty}>
          Không tải được chuyến đi. Kéo xuống để thử lại.
        </Text>
      ) : null}
      {trips.length > 0 ? (
        <Text style={styles.sectionTitle}>Chuyến bạn đã đăng</Text>
      ) : null}
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
      {bookings.length > 0 ? (
        <Text style={styles.sectionTitle}>Chuyến đang tham gia</Text>
      ) : null}
      {bookings.map((booking) => (
        <BookingCard booking={booking} key={booking.id} />
      ))}
      {!query.isError && trips.length === 0 && bookings.length === 0 ? (
        <Text style={sharedStyles.empty}>Bạn chưa có hành trình nào.</Text>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TripCard({ trip }: { trip: TripView }) {
  const departure = new Date(trip.departureAt);
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/trip/[id]", params: { id: trip.id } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <Status value={trip.status} />
        <Text style={styles.date}>
          ▣ {departure.toLocaleDateString("vi-VN")} ·{" "}
          {departure.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <Route destination={trip.destinationLabel} origin={trip.originLabel} />
      <View style={styles.footer}>
        <Text style={styles.meta}>
          ▰ {trip.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}
        </Text>
        <Text style={styles.seats}>
          Còn {trip.remainingSeats}/{trip.offeredSeats} chỗ
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

function BookingCard({ booking }: { booking: BookingView }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        styles.bookingCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <Status value={booking.status} />
        <Text style={styles.date}>Mã {booking.id.slice(0, 8)}</Text>
      </View>
      <View style={styles.bookingInfo}>
        <Text style={styles.bookingIcon}>✓</Text>
        <View style={styles.bookingCopy}>
          <Text style={styles.bookingTitle}>Chuyến đi đã kết nối</Text>
          <Text style={styles.meta}>
            Đón{" "}
            {new Date(booking.pickupAt).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.price}>
          {booking.priceVnd.toLocaleString("vi-VN")} đ
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    DRAFT: "Bản nháp",
    PUBLISHED: "Đang mở",
    ACTIVE: "Đang đi",
    COMPLETED: "Hoàn thành",
    CONFIRMED: "Đã xác nhận",
    CANCELLED: "Đã hủy",
    EXPIRED: "Hết hạn",
  };
  return (
    <View style={styles.status}>
      <Text style={styles.statusText}>{labels[value] ?? value}</Text>
    </View>
  );
}

function Route({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <View style={styles.route}>
      <View style={styles.pin}>
        <View style={styles.dot} />
        <View style={styles.line} />
        <View style={styles.endDot} />
      </View>
      <View style={styles.routeText}>
        <Text numberOfLines={2} style={styles.place}>
          {origin}
        </Text>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>↓</Text>
        </View>
        <Text numberOfLines={2} style={styles.place}>
          {destination}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    padding: 15,
  },
  statValue: { color: theme.colors.primary, fontSize: 22, fontWeight: "900" },
  statLabel: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  card: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: "#c6e2d8",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: 15,
    padding: 16,
  },
  bookingCard: { borderColor: "#e8d597" },
  pressed: { opacity: 0.86 },
  cardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  status: {
    backgroundColor: "#e5f6ef",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusText: { color: theme.colors.primary, fontSize: 11, fontWeight: "800" },
  date: { color: "#6d837b", fontSize: 11, fontWeight: "600" },
  route: {
    backgroundColor: "#f2faf7",
    borderRadius: theme.radius.md,
    flexDirection: "row",
    padding: 14,
  },
  pin: { alignItems: "center", marginRight: 12, width: 12 },
  dot: {
    backgroundColor: "#fff",
    borderColor: theme.colors.primary,
    borderRadius: 6,
    borderWidth: 2,
    height: 11,
    width: 11,
  },
  line: { backgroundColor: "#9ed8c5", flex: 1, minHeight: 26, width: 1 },
  endDot: {
    backgroundColor: "#e9bd52",
    borderRadius: 6,
    height: 11,
    width: 11,
  },
  routeText: { flex: 1, gap: 4 },
  place: { color: "#173f35", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  arrow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: 11,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  arrowText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  footer: { alignItems: "center", flexDirection: "row", gap: 12 },
  meta: { color: "#71857e", fontSize: 12 },
  seats: { color: "#376d5e", fontSize: 12, fontWeight: "700" },
  chevron: { color: theme.colors.primary, fontSize: 26, marginLeft: "auto" },
  bookingInfo: {
    alignItems: "center",
    backgroundColor: "#fffaf0",
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  bookingIcon: {
    backgroundColor: "#e9bd52",
    borderRadius: 18,
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  bookingCopy: { flex: 1 },
  bookingTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  price: { color: "#88651b", fontSize: 14, fontWeight: "900" },
});
