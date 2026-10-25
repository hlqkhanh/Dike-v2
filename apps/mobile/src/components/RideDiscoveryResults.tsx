import type { RideDiscoveryMatch, RidePostView } from "@dike/api-client-ts";
import { Avatar, Badge, Button, Card, RouteCard, Text, ui } from "./ui";
import { dateTime, money } from "@/core/hooks";

const distance = (meters: number) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;

export function RideDiscoveryResults({
  items,
  sentPostIds,
  onSelect,
}: {
  items: RideDiscoveryMatch[];
  sentPostIds: Set<string>;
  onSelect: (post: RidePostView) => void;
}) {
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={ui.muted}>
        {items.length} gợi ý phù hợp · Kiểm tra lại điểm đón trước khi gửi
      </Text>
      {items.map((item) => {
        const sent = sentPostIds.has(item.post.id);
        const driverOffer = item.post.type === "OFFER_RIDE";
        const offset = item.timeDifferenceMinutes;
        return (
          <Card key={item.post.id}>
            <Avatar
              name={item.post.ownerDisplayName}
              uri={item.post.ownerAvatarUrl}
              size={44}
            />
            <Text style={ui.sectionTitle}>{item.post.ownerDisplayName}</Text>
            <Badge
              label={
                offset === 0
                  ? "Cùng giờ"
                  : `${Math.abs(offset)} phút ${offset > 0 ? "sau" : "trước"}`
              }
              gold={!driverOffer}
            />
            <RouteCard
              origin={item.post.originLabel}
              destination={item.post.destinationLabel}
            />
            <Text style={ui.muted}>
              {dateTime(item.post.departureAt)} ·{" "}
              {driverOffer ? "Có người chở" : "Cần người chở"}
              {driverOffer && item.post.contributionPerKm > 0
                ? ` · ${money(item.post.contributionPerKm)}/km`
                : ""}
            </Text>
            <Text style={ui.muted}>
              Lệch tuyến đầu khoảng {distance(item.pickupDistanceMeters)} · cuối
              tuyến {distance(item.destinationDistanceMeters)}
            </Text>
            {item.post.note ? (
              <Text style={ui.muted}>{item.post.note}</Text>
            ) : null}
            <Button
              label={
                sent
                  ? "Đã gửi yêu cầu"
                  : driverOffer
                    ? "Yêu cầu đi ké"
                    : "Đề nghị chở"
              }
              disabled={sent}
              onPress={() => onSelect(item.post)}
            />
          </Card>
        );
      })}
    </>
  );
}
