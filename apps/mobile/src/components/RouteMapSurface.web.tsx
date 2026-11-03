import { router } from "expo-router";
import type { RoutePoint } from "@dike/api-client-ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "@/core/theme";
import { Text } from "./ui";
import {
  routeMapHtml,
  type RouteMapPresentation,
  type RouteMapViewport,
} from "@/core/route-map-html";

export function RouteMapSurface({
  geometry,
  onError,
  onPick,
  onMapPress,
  interactive,
  passenger = false,
  presentation,
  viewport,
}: {
  geometry: RoutePoint[];
  onError: () => void;
  onMapPress?: () => void;
  onPick?: (point: RoutePoint) => void;
  interactive?: boolean;
  passenger?: boolean;
  presentation?: RouteMapPresentation;
  viewport?: RouteMapViewport;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const selectable = !!onPick;
  const isInteractive = interactive !== undefined ? interactive : selectable;
  const html = useMemo(
    () =>
      routeMapHtml(
        geometry,
        selectable,
        isInteractive,
        passenger,
        presentation,
      ),
    [geometry, selectable, isInteractive, passenger, presentation],
  );
  useEffect(() => {
    setReady(false);
  }, [html]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        typeof event.data !== "string"
      )
        return;
      try {
        const message = JSON.parse(event.data);
        if (
          message.source === "dike-route-map" &&
          message.type === "profile" &&
          typeof message.userId === "string" &&
          message.userId.length > 0 &&
          message.userId.length <= 128
        )
          router.push({
            pathname: "/user/[id]",
            params: { id: message.userId },
          });
        if (message.source === "dike-route-map" && message.type === "tap")
          onMapPress?.();
        if (message.source === "dike-route-map" && message.type === "error")
          onError();
        if (message.source === "dike-route-map" && message.type === "ready")
          setReady(true);
        if (
          message.source === "dike-route-map" &&
          message.type === "pick" &&
          Number.isFinite(message.point?.latitude) &&
          Math.abs(message.point.latitude) <= 85 &&
          Number.isFinite(message.point?.longitude) &&
          Math.abs(message.point.longitude) <= 180
        )
          onPick?.(message.point);
      } catch {
        /* Ignore unrelated frame messages. */
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onError, onPick, onMapPress]);
  useEffect(() => {
    if (ready && viewport)
      frame.current?.contentWindow?.postMessage(
        { source: "dike-map-controls", type: "viewport", viewport },
        "*",
      );
  }, [ready, viewport]);
  return (
    <View style={styles.map}>
      <iframe
        ref={frame}
        title="Bản đồ tuyến đường"
        srcDoc={html}
        style={{ border: 0, width: "100%", height: "100%" }}
      />
      {!ready ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.loading,
            passenger && { backgroundColor: theme.colors.passengerSoft },
          ]}
        >
          <ActivityIndicator
            color={passenger ? theme.colors.passengerInk : theme.colors.primary}
          />
          <Text accessibilityLiveRegion="polite" style={styles.label}>
            Đang tải bản đồ…
          </Text>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  map: { width: "100%", height: "100%" },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  label: { color: theme.colors.inkMuted, fontSize: 12 },
});
