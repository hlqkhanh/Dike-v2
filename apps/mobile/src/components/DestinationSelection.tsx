import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { PlaceResponse } from "@dike/api-client-ts";
import {
  currentCoordinates,
  usePlaces,
  useResolvePlace,
  type SavedPlace,
} from "@/core/places";
import { theme } from "@/core/theme";
import { PlacePicker } from "./PlacePicker";
import { BottomSheet, Button, ErrorText, Icon, Text, ui } from "./ui";

export function DestinationSelection({
  origin,
  destination,
  active,
  onActive,
  onSelect,
  onMap,
  onBack,
}: {
  origin?: PlaceResponse;
  destination?: PlaceResponse;
  active: "origin" | "destination";
  onActive: (target: "origin" | "destination") => void;
  onSelect: (
    place: PlaceResponse | undefined,
    target: "origin" | "destination",
  ) => void;
  onMap: () => void;
  onBack: () => void;
}) {
  const places = usePlaces();
  const resolve = useResolvePlace();
  const [savedOpen, setSavedOpen] = useState(false);
  const choose = useMutation({
    mutationFn: async ({
      place,
      target,
    }: {
      place?: SavedPlace;
      target: "origin" | "destination";
    }) => ({
      place: await resolve(place ?? (await currentCoordinates())),
      target,
    }),
    onSuccess: ({ place, target }) => {
      setSavedOpen(false);
      onSelect(place, target);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Vui lòng thử lại.";
      const needsSettings = /quyền vị trí|cài đặt/i.test(message);
      Alert.alert(
        needsSettings ? "Cho phép truy cập vị trí" : "Chưa thể chọn địa điểm",
        needsSettings
          ? "Dike cần quyền vị trí để xác định điểm đi của bạn. Hãy mở cài đặt và cho phép truy cập vị trí. Bạn vẫn có thể nhập địa chỉ thủ công."
          : message,
        needsSettings
          ? [
              { text: "Để sau", style: "cancel" },
              {
                text: "Mở cài đặt",
                onPress: () => {
                  void Linking.openSettings().catch(() => {
                    Alert.alert(
                      "Không mở được cài đặt",
                      "Vui lòng mở Cài đặt trên điện thoại, chọn Dike và bật quyền vị trí.",
                    );
                  });
                },
              },
            ]
          : [{ text: "Đã hiểu" }],
      );
    },
  });
  const remove = useMutation({ mutationFn: places.remove });
  return (
    <View style={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={active === "origin" ? () => onActive("destination") : onBack}
          style={styles.backButton}
          hitSlop={theme.spacing.xs}
        >
          <Icon name="arrow-back" />
        </Pressable>
        <View style={styles.copy}>
          {active === "origin" ? (
            <PlacePicker
              key="origin"
              compact
              autoFocus
              label="Điểm đi"
              value={origin}
              onFocus={() => onActive("origin")}
              onChange={(place) => onSelect(place, "origin")}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thay đổi điểm đi"
              style={styles.originField}
              onPress={() =>
                origin
                  ? onActive("origin")
                  : choose.mutate({ target: "origin" })
              }
              disabled={choose.isPending}
            >
              <Icon
                name="radio-button-on"
                size={theme.destination.iconSize}
                color={theme.destination.ink}
              />
              <Text numberOfLines={1} style={[styles.headerTitle, styles.copy]}>
                {origin?.displayLabel ?? "Sử dụng vị trí hiện tại"}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.fieldSpacer} />
      </View>
      <View style={styles.searchRow}>
        <View style={styles.fieldSpacer} />
        <View style={styles.copy}>
          <PlacePicker
            key="destination"
            compact
            label="Điểm đến"
            value={destination}
            onFocus={() => onActive("destination")}
            onChange={(place) => onSelect(place, "destination")}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chọn địa điểm trên bản đồ"
          style={styles.add}
          onPress={onMap}
        >
          <Icon name="add" color={theme.colors.surface} />
        </Pressable>
      </View>
      {active === "origin" || !origin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sử dụng vị trí hiện tại làm điểm đi"
          disabled={choose.isPending}
          style={styles.gpsRow}
          onPress={() => choose.mutate({ target: "origin" })}
        >
          <View style={styles.circle}>
            <Icon name="locate-outline" size={theme.destination.iconSize} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>
              {choose.isPending
                ? "Đang lấy vị trí…"
                : "Sử dụng vị trí hiện tại"}
            </Text>
            <Text style={styles.subtitle}>
              Lấy vị trí hiện tại của bạn bằng GPS
            </Text>
          </View>
        </Pressable>
      ) : null}
      <ErrorText error={places.error || remove.error} />
      {places.isPending ? (
        <Text accessibilityLiveRegion="polite" style={ui.muted}>
          Đang tải địa chỉ…
        </Text>
      ) : null}
      {places.isError ? (
        <Button
          label="Thử tải lại địa chỉ"
          variant="secondary"
          onPress={() => void places.refetch()}
        />
      ) : null}
      {!places.isPending &&
      !places.isError &&
      !places.preferences.recent.length ? (
        <Text style={styles.empty}>
          Địa điểm bạn chọn sẽ xuất hiện ở đây để tìm nhanh lần sau.
        </Text>
      ) : null}
      <View>
        {places.preferences.recent.map((place) => (
          <View key={`${place.latitude}:${place.longitude}`} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn ${place.displayLabel}`}
              disabled={choose.isPending}
              style={styles.address}
              onPress={() => choose.mutate({ place, target: active })}
            >
              <View style={styles.circle}>
                <Icon
                  name="time-outline"
                  size={theme.destination.iconSize}
                  color={theme.destination.icon}
                />
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={2} style={styles.title}>
                  {place.displayLabel.split(",")[0]}
                </Text>
                <Text numberOfLines={2} style={styles.subtitle}>
                  {place.displayLabel.includes(",")
                    ? place.displayLabel
                        .slice(place.displayLabel.indexOf(",") + 1)
                        .trim()
                    : place.publicAreaLabel}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xóa ${place.displayLabel} khỏi gần đây`}
              disabled={remove.isPending}
              style={styles.touch}
              onPress={() => remove.mutate(place)}
            >
              <Icon
                name="ellipsis-vertical"
                size={18}
                color={theme.colors.inkMuted}
              />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.actionArea}>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.action, styles.actionDivider]}
            onPress={() => setSavedOpen(true)}
          >
            <View style={styles.circle}>
              <Icon
                name="heart"
                size={theme.destination.iconSize}
                color={theme.destination.icon}
              />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>Địa chỉ đã lưu</Text>
              <Text style={styles.subtitle}>
                Lưu địa chỉ để đặt xe nhanh hơn.
              </Text>
            </View>
            <Icon name="chevron-forward" size={20} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.action}
            onPress={onMap}
          >
            <View style={styles.circle}>
              <Icon
                name="map-outline"
                size={theme.destination.iconSize}
                color={theme.destination.icon}
              />
            </View>
            <Text style={[styles.title, styles.copy]}>Chọn trên bản đồ</Text>
            <Icon name="chevron-forward" size={20} />
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Text style={styles.title}>Không thấy địa điểm bạn cần?</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.action}
            onPress={onMap}
          >
            <View style={styles.circle}>
              <Icon name="add" size={24} color={theme.destination.icon} />
            </View>
            <Text style={[styles.copy, styles.description]}>
              Thêm địa điểm mới để chuyến đi luôn chuẩn xác!
            </Text>
            <Icon name="chevron-forward" size={20} />
          </Pressable>
        </View>
      </View>
      <BottomSheet
        visible={savedOpen}
        title="Địa chỉ đã lưu"
        onClose={() => setSavedOpen(false)}
      >
        {places.preferences.pickup ? (
          <Button
            label={places.preferences.pickup.displayLabel}
            variant="secondary"
            pending={choose.isPending}
            onPress={() =>
              choose.mutate({
                place: places.preferences.pickup,
                target: active,
              })
            }
          />
        ) : (
          <Text style={ui.muted}>
            Chưa có điểm đi đã lưu. Điểm đi sẽ được lưu sau khi bạn xác nhận
            trên bản đồ.
          </Text>
        )}
      </BottomSheet>
    </View>
  );
}

const d = theme.destination;
const styles = StyleSheet.create({
  content: { backgroundColor: theme.colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: { fontSize: d.titleSize, fontWeight: "700", color: d.ink },
  headerSubtitle: {
    fontSize: d.bodySize,
    color: d.muted,
    marginTop: theme.spacing.xs,
  },
  touch: {
    minWidth: theme.journey.sheetHandleTarget,
    minHeight: theme.journey.sheetHandleTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  current: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  locationTouch: {
    minWidth: theme.journey.sheetHandleTarget,
    minHeight: theme.journey.sheetHandleTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  locationDot: {
    width: d.circleSize,
    height: d.circleSize,
    backgroundColor: d.icon,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: d.circleSize,
    height: d.circleSize,
    borderRadius: theme.radius.pill,
    backgroundColor: d.iconBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  copy: { flex: 1, minWidth: 0 },
  fieldSpacer: { width: theme.destination.railWidth },
  backButton: {
    width: theme.destination.railWidth,
    minHeight: theme.journey.sheetHandleTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  originField: {
    minHeight: theme.journey.sheetHandleTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.destination.rowSpacing,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.canvas,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.destination.rowSpacing,
  },
  add: {
    minWidth: theme.destination.railWidth,
    minHeight: theme.journey.sheetHandleTarget,
    borderRadius: theme.radius.sm,
    backgroundColor: d.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  editOrigin: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.journey.sheetHandleTarget,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  empty: { color: d.muted, fontSize: d.bodySize, padding: theme.spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: d.divider,
  },
  address: {
    flex: 1,
    minHeight: d.rowHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: d.rowSpacing,
  },
  title: { fontSize: d.titleSize, fontWeight: "700", color: d.ink },
  subtitle: {
    fontSize: d.bodySize,
    color: d.muted,
    marginTop: theme.spacing.xs,
    lineHeight: d.lineHeight,
  },
  description: {
    fontSize: d.titleSize,
    color: d.ink,
    lineHeight: d.lineHeight,
  },
  actionArea: {
    backgroundColor: theme.colors.canvas,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  actions: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: d.rowSpacing,
    paddingVertical: theme.spacing.sm,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: d.rowSpacing,
    minHeight: d.rowHeight,
  },
  actionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: d.divider,
  },
});
