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
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme } from "@/core/theme";
import { useReducedMotion } from "@/core/accessibility";

const DEFAULT_STOPS = [0.28, 0.6, 1] as const;

// The stage owns the map; only this sibling changes size during a gesture.
export function RideComposerSheet({
  children,
  testID,
  initialSnap = 1,
  snapFractions = DEFAULT_STOPS,
  bodyStyle,
  handleHeight,
  expandSignal = 0,
  collapseSignal = 0,
  onBackgroundPress,
  expandOnKeyboard = true,
  fitToContent = false,
  syncKeyboardCollapse = false,
}: PropsWithChildren<{
  testID: string;
  initialSnap?: 0 | 1 | 2;
  snapFractions?: readonly [number, number, number];
  bodyStyle?: StyleProp<ViewStyle>;
  handleHeight?: number;
  expandSignal?: number;
  collapseSignal?: number;
  onBackgroundPress?: () => void;
  expandOnKeyboard?: boolean;
  fitToContent?: boolean;
  syncKeyboardCollapse?: boolean;
}>) {
  const [height, setHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [grabberHeight, setGrabberHeight] = useState(
    handleHeight ?? theme.journey.sheetHandleTarget,
  );
  const [snap, setSnap] = useState<number>(initialSnap);
  const reducedMotion = useReducedMotion();
  const size = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const snapRef = useRef<number>(initialSnap);
  const target = useRef<number | undefined>(undefined);
  const start = useRef(0);
  const scrollY = useRef(0);
  const dragging = useRef(false);
  const lastDrag = useRef(0);
  const fitTarget = useRef(fitToContent);
  const scroll = useRef<ScrollView>(null);
  const [collapsedFraction, middleFraction, expandedFraction] = snapFractions;
  const stops = useMemo(
    () => [
      height * collapsedFraction,
      height * middleFraction,
      height * expandedFraction,
    ],
    [height, collapsedFraction, middleFraction, expandedFraction],
  );
  const contentLimit =
    fitToContent && contentHeight > 0
      ? contentHeight + grabberHeight
      : Infinity;
  const animate = (index: number, focus = false) => {
    fitTarget.current = fitToContent && focus;
    if (index < 2 && syncKeyboardCollapse) Keyboard.dismiss();
    const next = fitTarget.current
      ? Math.min(stops[index], contentLimit)
      : stops[index];
    if (!height || (snapRef.current === index && target.current === next))
      return;
    snapRef.current = index;
    target.current = next;
    setSnap(index);
    if (index !== 2) scroll.current?.scrollTo({ y: 0, animated: false });
    size.stopAnimation();
    if (reducedMotion) {
      size.setValue(next);
      return;
    }
    if (focus) {
      Animated.timing(size, {
        toValue: next,
        duration: 220,
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.spring(size, {
      toValue: next,
      useNativeDriver: false,
      stiffness: theme.journey.sheetSpringStiffness,
      damping: theme.journey.sheetSpringDamping,
      mass: 1,
      overshootClamping: true,
    }).start();
  };
  useEffect(() => {
    const listener = size.addListener(({ value }) => {
      current.current = value;
    });
    return () => size.removeListener(listener);
  }, [size]);
  useEffect(() => {
    if (!height) return;
    // Never interrupt a finger gesture or a spring for an unchanged target.
    if (dragging.current) return;
    const next = fitTarget.current
      ? Math.min(stops[snapRef.current], contentLimit)
      : stops[snapRef.current];
    if (target.current === next) return;
    size.stopAnimation();
    target.current = next;
    current.current = next;
    size.setValue(next);
  }, [height, stops, contentLimit, size]);
  const controls = useRef({ animate, stops, snap });
  controls.current = { animate, stops, snap };
  useEffect(() => {
    if (expandSignal > 0) controls.current.animate(2, true);
  }, [expandSignal]);
  useEffect(() => {
    if (collapseSignal > 0) controls.current.animate(1);
  }, [collapseSignal]);
  useEffect(() => {
    const subscriptions: ReturnType<typeof Keyboard.addListener>[] = [];
    if (expandOnKeyboard)
      subscriptions.push(
        Keyboard.addListener("keyboardDidShow", () =>
          controls.current.animate(2, true),
        ),
      );
    if (syncKeyboardCollapse)
      subscriptions.push(
        Keyboard.addListener(
          "keyboardDidHide",
          () =>
            !dragging.current &&
            controls.current.animate(Math.min(controls.current.snap, 1), true),
        ),
      );
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [expandOnKeyboard, syncKeyboardCollapse]);
  const responders = useMemo(() => {
    const createResponder = (handle: boolean) =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > theme.spacing.sm &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
          (handle ||
            (gesture.dy < 0 &&
              current.current < controls.current.stops[2] - 1) ||
            (scrollY.current <= 0 && gesture.dy > 0)),
        onPanResponderGrant: () => {
          dragging.current = true;
          fitTarget.current = false;
          target.current = undefined;
          size.stopAnimation();
          start.current = current.current;
        },
        onPanResponderMove: (_, gesture) => {
          const points = controls.current.stops;
          const next = Math.max(
            points[0],
            Math.min(points[2], start.current - gesture.dy),
          );
          current.current = next;
          size.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          dragging.current = false;
          lastDrag.current = Date.now();
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
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          dragging.current = false;
          controls.current.animate(controls.current.snap);
        },
      });
    return { body: createResponder(false), handle: createResponder(true) };
  }, [size]);
  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        testID={testID}
        aria-expanded={snap === 2}
        style={[styles.sheet, { height: size }]}
        {...responders.body.panHandlers}
        {...(Platform.OS === "web"
          ? {
              onWheel: (event: { nativeEvent: { deltaY: number } }) => {
                const { snap: currentSnap, animate: go } = controls.current;
                if (event.nativeEvent.deltaY > 0 && currentSnap !== 2) go(2);
                else if (
                  event.nativeEvent.deltaY < 0 &&
                  currentSnap === 2 &&
                  scrollY.current <= 0
                )
                  go(1);
              },
            }
          : {})}
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
          onPress={() => {
            if (Date.now() - lastDrag.current < 250) return;
            onBackgroundPress?.();
            animate((snap + 1) % 3);
          }}
          {...responders.handle.panHandlers}
          hitSlop={handleHeight ? 8 : undefined}
          onLayout={(event) =>
            setGrabberHeight(event.nativeEvent.layout.height)
          }
          style={[
            styles.grabber,
            handleHeight ? { minHeight: handleHeight } : null,
          ]}
        >
          <View style={styles.handle} />
        </Pressable>
        <ScrollView
          ref={scroll}
          testID="composer-scroll"
          style={styles.content}
          scrollEnabled={snap === 2}
          onContentSizeChange={(_, contentSize) =>
            setContentHeight(contentSize)
          }
          bounces={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={[
            styles.body,
            onBackgroundPress && !fitToContent && { flexGrow: 1 },
            bodyStyle,
          ]}
        >
          {onBackgroundPress ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Bỏ chọn yêu cầu"
              accessibilityRole="button"
              onPress={onBackgroundPress}
            />
          ) : null}
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
