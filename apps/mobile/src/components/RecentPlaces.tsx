import type { PlaceResponse } from "@dike/api-client-ts";
import { useMutation } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";
import {
  usePlaces,
  useResolvePlace,
  currentCoordinates,
  type SavedPlace,
} from "@/core/places";
import { theme } from "@/core/theme";
import { Button, ErrorText, Icon, Text, ui } from "./ui";

export function RecentPlaces({
  onSelect,
  onMap,
}: {
  onSelect: (place: PlaceResponse) => void;
  onMap?: () => void;
}) {
  const places = usePlaces();
  const resolve = useResolvePlace();
  const choose = useMutation({
    mutationFn: async (place?: SavedPlace) =>
      resolve(place ?? (await currentCoordinates())),
    onSuccess: onSelect,
  });
  const remove = useMutation({ mutationFn: places.remove });
  return (
    <View style={styles.list}>
      <Button
        label="Dùng vị trí hiện tại"
        icon="locate-outline"
        variant="secondary"
        pending={choose.isPending}
        onPress={() => choose.mutate(undefined)}
      />
      {onMap ? (
        <Button
          label="Chọn trên bản đồ"
          icon="map-outline"
          variant="secondary"
          onPress={onMap}
        />
      ) : null}
      <ErrorText error={choose.error || places.error || remove.error} />
      <Text accessibilityRole="header" style={ui.sectionTitle}>
        Địa điểm gần đây
      </Text>
      {places.isPending ? (
        <Text style={ui.muted}>Đang tải địa chỉ…</Text>
      ) : !places.preferences.recent.length ? (
        <Text style={ui.muted}>
          Địa điểm bạn chọn sẽ xuất hiện ở đây để tìm nhanh lần sau.
        </Text>
      ) : null}
      {places.preferences.recent.map((place) => (
        <View key={`${place.latitude}:${place.longitude}`} style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Chọn ${place.displayLabel}`}
            disabled={choose.isPending}
            onPress={() => choose.mutate(place)}
            style={styles.address}
          >
            <Icon name="time-outline" />
            <View style={styles.copy}>
              <Text style={styles.title}>{place.displayLabel}</Text>
              <Text style={ui.muted}>{place.publicAreaLabel}</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xóa ${place.displayLabel} khỏi gần đây`}
            disabled={remove.isPending}
            onPress={() => remove.mutate(place)}
            style={styles.remove}
          >
            <Icon name="close" size={20} color={theme.colors.inkMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  address: {
    flex: 1,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  copy: { flex: 1, gap: theme.spacing.xs },
  title: { fontWeight: "700" },
  remove: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
