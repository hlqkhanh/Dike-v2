import type { RoutePoint } from "@dike/api-client-ts";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TurboModuleRegistry,
  View,
} from "react-native";
import type { WebView as NativeWebView } from "react-native-webview";
import {
  routeMapHtml,
  type RouteMapPresentation,
  type RouteMapViewport,
} from "@/core/route-map-html";
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
  const frame = useRef<NativeWebView>(null);
  const selectable = !!onPick;
  const isInteractive = interactive !== undefined ? interactive : selectable;
  const [ready, setReady] = useState(false);
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
    if (ready && viewport)
      frame.current?.injectJavaScript(
        "window.dikeSetViewport?.(" + JSON.stringify(viewport) + ");true;",
      );
  }, [ready, viewport]);
  const source = useMemo(
    () => ({ html, baseUrl: "https://tiles.openfreemap.org/" }),
    [html],
  );
  if (!TurboModuleRegistry.get("RNCWebViewModule"))
    return <Text style={styles.upgrade}>Cập nhật ứng dụng để xem bản đồ</Text>;
  return (
    <View style={styles.map}>
      <Suspense
        fallback={
          <ActivityIndicator
            color={passenger ? theme.colors.passengerInk : h.primary}
          />
        }
      >
        <WebView
          ref={frame}
          source={source}
          originWhitelist={["*"]}
          style={styles.map}
          containerStyle={styles.map}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          setSupportMultipleWindows={false}
          mixedContentMode="compatibility"
          cacheEnabled
          onError={onError}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.source === "dike-route-map" && message.type === "tap")
                onMapPress?.();
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
          style={[
            StyleSheet.absoluteFill,
            styles.loading,
            passenger && { backgroundColor: theme.colors.passengerSoft },
          ]}
        >
          <ActivityIndicator
            color={passenger ? theme.colors.passengerInk : h.primary}
          />
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
