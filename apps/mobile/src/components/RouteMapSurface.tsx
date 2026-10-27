import type { RoutePoint } from "@dike/api-client-ts";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TurboModuleRegistry,
  View,
} from "react-native";
import { routeMapHtml } from "@/core/route-map-html";
import { homeTheme as h } from "@/core/home-theme";
import { theme } from "@/core/theme";
import { Text } from "./ui";

// Older development builds must remain usable until the new APK is installed.
const WebView = lazy(() =>
  import("react-native-webview").then((module) => ({
    default: module.WebView,
  })),
);

export function RouteMapSurface({
  geometry,
  onError,
  onPick,
  interactive,
}: {
  geometry: RoutePoint[];
  onError: () => void;
  onPick?: (point: RoutePoint) => void;
  interactive?: boolean;
}) {
  const selectable = !!onPick;
  const isInteractive = interactive !== undefined ? interactive : selectable;
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => routeMapHtml(geometry, selectable, isInteractive),
    [geometry, selectable, isInteractive],
  );
  useEffect(() => {
    setReady(false);
  }, [html]);
  if (!TurboModuleRegistry.get("RNCWebViewModule"))
    return <Text style={styles.upgrade}>Cập nhật ứng dụng để xem bản đồ</Text>;
  return (
    <View style={styles.map}>
      <Suspense fallback={<ActivityIndicator color={h.primary} />}>
        <WebView
          source={{ html, baseUrl: "https://tiles.openfreemap.org/" }}
          originWhitelist={["*"]}
          style={styles.map}
          containerStyle={styles.map}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          setSupportMultipleWindows={false}
          onError={onError}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (
                message.source === "dike-route-map" &&
                message.type === "error"
              )
                onError();
              if (
                message.source === "dike-route-map" &&
                message.type === "ready"
              )
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
              /* Ignore unrelated WebView messages. */
            }
          }}
        />
      </Suspense>
      {!ready ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.loading]}
        >
          <ActivityIndicator color={h.primary} />
          <Text style={styles.label}>Đang tải bản đồ…</Text>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  map: { width: "100%", height: "100%", backgroundColor: "transparent" },
  loading: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  label: { fontSize: 12, color: h.muted },
  upgrade: { fontSize: 10, color: h.muted, padding: 8, textAlign: "center" },
});
