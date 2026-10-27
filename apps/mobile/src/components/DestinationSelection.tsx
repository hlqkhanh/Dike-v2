import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
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
  const [locationModalVisible, setLocationModalVisible] = useState(false);
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
      const needsSettings =
        /quyền vị trí đã bị từ chối|chưa được cấp quyền vị trí/i.test(message);
      if (needsSettings) {
        setLocationModalVisible(true);
      } else {
        Alert.alert("Định vị vị trí", message, [{ text: "Đã hiểu" }]);
      }
    },
  });
  const remove = useMutation({ mutationFn: places.remove });
  const inlineError = (() => {
    const err = places.error || remove.error;
    if (!err) return undefined;
    const msg = err instanceof Error ? err.message : String(err);
    if (/quyền vị trí|vị trí|location/i.test(msg)) return undefined;
    return err;
  })();
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
      {inlineError ? <ErrorText error={inlineError} /> : null}
      {places.isPending ? (
        <Text accessibilityLiveRegion="polite" style={ui.muted}>
          Đang tải địa chỉ…
        </Text>
      ) : null}
      {places.isError && inlineError ? (
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
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLocationModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Icon
                name="navigate-circle-outline"
                size={36}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.modalTitle}>Quyền truy cập vị trí</Text>
            <Text style={styles.modalMessage}>
              Diké cần quyền vị trí để tự động định vị điểm đón của bạn bằng
              GPS.{"\n\n"}Vui lòng mở Cài đặt thiết bị và cấp quyền truy cập vị
              trí cho ứng dụng.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở cài đặt"
                style={({ pressed }) => [
                  styles.modalPrimaryBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => {
                  setLocationModalVisible(false);
                  void Linking.openSettings().catch(() => {
                    Alert.alert(
                      "Không mở được cài đặt",
                      "Vui lòng mở Cài đặt trên điện thoại, chọn Dike và bật quyền vị trí.",
                    );
                  });
                }}
              >
                <Icon name="settings-outline" size={18} color="#fff" />
                <Text style={styles.modalPrimaryText}>Mở cài đặt</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Để sau, tôi tự chọn điểm"
                style={({ pressed }) => [
                  styles.modalSecondaryBtn,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => setLocationModalVisible(false)}
              >
                <Text style={styles.modalSecondaryText}>
                  Để sau, tôi tự nhập địa chỉ
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    ...theme.shadow.card,
    elevation: 10,
  },
  modalIconBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#e8f5ee",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#c2e6d3",
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: theme.colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    color: theme.colors.inkMuted,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 22,
  },
  modalActions: {
    width: "100%",
    gap: 10,
  },
  modalPrimaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPrimaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  modalSecondaryBtn: {
    backgroundColor: "#f4f6f8",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
