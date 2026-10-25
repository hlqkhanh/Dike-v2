import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  Animated,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { theme } from "@/core/theme";
import { useReducedMotion } from "@/core/accessibility";

// The stage owns the map; only this sibling changes size during a gesture.
export function RideComposerSheet({
  children,
  testID,
}: PropsWithChildren<{ testID: string }>) {
  const [height, setHeight] = useState(0);
  const [snap, setSnap] = useState(1);
  const reducedMotion = useReducedMotion();
  const size = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const start = useRef(0);
  const scrollY = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const stops = useMemo(() => [height * 0.28, height * 0.6, height], [height]);
  const animate = (index: number) => {
    setSnap(index);
    if (index !== 2) scroll.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(size, {
      toValue: stops[index],
      useNativeDriver: false,
      stiffness: theme.journey.sheetSpringStiffness,
      damping: theme.journey.sheetSpringDamping,
      mass: 1,
      overshootClamping: true,
      ...(reducedMotion ? { overshootClamping: true } : {}),
    }).start();
    if (reducedMotion) {
      size.stopAnimation();
      size.setValue(stops[index]);
    }
  };
  useEffect(() => {
    const listener = size.addListener(({ value }) => {
      current.current = value;
    });
    return () => size.removeListener(listener);
  }, [size]);
  useEffect(() => {
    size.stopAnimation();
    if (reducedMotion) size.setValue(height * 0.6);
    else
      Animated.spring(size, {
        toValue: height * 0.6,
        useNativeDriver: false,
        stiffness: theme.journey.sheetSpringStiffness,
        damping: theme.journey.sheetSpringDamping,
        overshootClamping: true,
      }).start();
    setSnap(1);
  }, [height, size, reducedMotion]);
  const controls = useRef({ animate, stops, snap });
  controls.current = { animate, stops, snap };
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () =>
      controls.current.animate(2),
    );
    return () => subscription.remove();
  }, []);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > theme.spacing.sm &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
          (controls.current.snap !== 2 ||
            (scrollY.current <= 0 && gesture.dy > 0)),
        onPanResponderGrant: () => {
          size.stopAnimation();
          start.current = current.current;
        },
        onPanResponderMove: (_, gesture) => {
          const points = controls.current.stops;
          size.setValue(
            Math.max(
              points[0],
              Math.min(points[2], start.current - gesture.dy),
            ),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const projected =
            current.current -
            gesture.vy * theme.journey.sheetVelocityProjection;
          const points = controls.current.stops;
          const index = points.reduce(
            (best, point, i) =>
              Math.abs(point - projected) < Math.abs(points[best] - projected)
                ? i
                : best,
            0,
          );
          controls.current.animate(index);
        },
        onPanResponderTerminate: () =>
          controls.current.animate(controls.current.snap),
      }),
    [size],
  );
  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        testID={testID}
        style={[styles.sheet, { height: size }]}
        {...responder.panHandlers}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thay đổi độ mở bảng chọn"
          accessibilityHint="Bấm để mở rộng hoặc thu gọn"
          accessibilityValue={{
            text: ["Thu gọn", "Mở một phần", "Mở rộng"][snap],
          }}
          accessibilityActions={[
            { name: "increment", label: "Mở rộng" },
            { name: "decrement", label: "Thu gọn" },
          ]}
          onAccessibilityAction={(event) =>
            animate(
              Math.max(
                0,
                Math.min(
                  2,
                  snap +
                    (event.nativeEvent.actionName === "increment" ? 1 : -1),
                ),
              ),
            )
          }
          onPress={() => animate((snap + 1) % 3)}
          {...responder.panHandlers}
          onMoveShouldSetResponder={() => true}
          style={styles.grabber}
        >
          <View style={styles.handle} />
        </Pressable>
        <ScrollView
          ref={scroll}
          testID="composer-scroll"
          style={styles.content}
          scrollEnabled={snap === 2}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={styles.body}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderTopStartRadius: theme.radius.xl,
    borderTopEndRadius: theme.radius.xl,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  grabber: {
    minHeight: theme.journey.sheetHandleTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: theme.spacing.xl,
    height: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkMuted,
  },
  content: { flex: 1 },
  body: {
    padding: theme.spacing.md,
    paddingTop: 0,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
});
