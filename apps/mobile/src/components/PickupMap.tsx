import type { PlaceResponse, RoutePoint } from "@dike/api-client-ts";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useResolvePlace } from "@/core/places";
import { theme } from "@/core/theme";
import { RouteMapSurface } from "./RouteMapSurface";
import { Button, ErrorText, Field, Icon, Text, ui } from "./ui";

export function PickupMap({
  place,
  onConfirm,
  onSearch,
  pending,
  note,
  onNoteChange,
  title = "Xác nhận điểm đón",
}: {
  place: PlaceResponse;
  onConfirm: (place: PlaceResponse) => void;
  onSearch: () => void;
  title?: string;
  pending?: boolean;
  note?: string;
  onNoteChange?: (note: string) => void;
}) {
  // The map's initial center stays fixed while reverse-geocoding new pin positions.
  const [geometry] = useState<RoutePoint[]>([
    { latitude: place.latitude, longitude: place.longitude },
  ]);
  const [selected, setSelected] = useState(place);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [point, setPoint] = useState<RoutePoint>();
  const revision = useRef(0);
  const resolve = useResolvePlace();
  const lookup = useMutation({
    mutationFn: async ({
      point,
      version,
    }: {
      point: RoutePoint;
      version: number;
    }) => ({ value: await resolve(point), version }),
    onSuccess: ({ value, version }) => {
      if (version === revision.current) {
        setSelected(value);
        setPoint(undefined);
      }
    },
  });
  const pick = (next: RoutePoint) => {
    revision.current++;
    setPoint(next);
    lookup.reset();
  };
  const runLookup = lookup.mutate;
  useEffect(() => {
    if (!point) return;
    const timer = setTimeout(
      () => runLookup({ point, version: revision.current }),
      500,
    );
    return () => clearTimeout(timer);
  }, [point, runLookup]);
  return (
    <KeyboardAvoidingView
      style={styles.layout}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View accessibilityLabel="Bản đồ chọn điểm đón" style={styles.map}>
        {failed ? (
          <View style={styles.fallback}>
            <Icon name="map-outline" size={32} />
            <Text style={ui.muted}>
              Chưa tải được bản đồ. Bạn có thể dùng địa chỉ đã chọn.
            </Text>
            <Button
              label="Thử tải lại bản đồ"
              variant="secondary"
              onPress={() => {
                setAttempt((v) => v + 1);
                setFailed(false);
              }}
            />
          </View>
        ) : (
          <RouteMapSurface
            key={attempt}
            geometry={geometry}
            onError={() => setFailed(true)}
            onPick={pick}
          />
        )}
      </View>
      <ScrollView
        style={styles.panelScroll}
        contentContainerStyle={styles.panel}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={ui.sectionTitle}>
          {title}
        </Text>
        <Text style={ui.muted}>
          Di chuyển bản đồ để chỉnh ghim, hoặc tìm lại địa chỉ.
        </Text>
        {point ? (
          <>
            <Text style={ui.muted}>
              Ghim mới: {point.latitude.toFixed(5)},{" "}
              {point.longitude.toFixed(5)}
            </Text>
            {!lookup.isError ? (
              <Text accessibilityLiveRegion="polite" style={ui.muted}>
                Đang lấy địa chỉ tại ghim…
              </Text>
            ) : null}
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.address}>
            {selected.displayLabel}
          </Text>
        )}
        <ErrorText error={lookup.error} />
        {lookup.isError && point ? (
          <Button
            label="Thử lấy lại địa chỉ"
            variant="secondary"
            onPress={() => lookup.mutate({ point, version: revision.current })}
          />
        ) : null}
        {onNoteChange ? (
          <Field
            label="Ghi chú điểm đón (không bắt buộc)"
            value={note}
            editable={!pending}
            onChangeText={onNoteChange}
            maxLength={150}
            placeholder="Ví dụ: đón ở cổng chính"
          />
        ) : null}
        <Button
          label="Tìm lại địa chỉ"
          variant="secondary"
          icon="search"
          onPress={onSearch}
          disabled={pending}
        />
        <Button
          label={title}
          pending={pending}
          disabled={!!point || lookup.isPending}
          onPress={() => onConfirm(selected)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  layout: { flex: 1 },
  map: {
    flex: 1,
    minHeight: theme.journey.vehicleHeight,
    backgroundColor: theme.colors.surfaceMuted,
  },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  fallback: {
    flex: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopStartRadius: theme.radius.xl,
    borderTopEndRadius: theme.radius.xl,
  },
  address: { fontWeight: "700", fontSize: 16 },
});
