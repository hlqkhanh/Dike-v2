import { createContext, useContext, type RefObject } from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedTransparency } from "@/core/accessibility";

export const JourneyBlurTarget = createContext<
  RefObject<View | null> | undefined
>(undefined);

export function JourneyGlass({ radius = 26 }: { radius?: number }) {
  const target = useContext(JourneyBlurTarget);
  const reduced = useReducedTransparency();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[styles.clip, { borderRadius: radius }, reduced && styles.opaque]}
    >
      {!reduced ? (
        <>
          <BlurView
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={42}
            blurReductionFactor={2}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.34)",
              "rgba(245,255,250,0.12)",
              "rgba(255,255,255,0.20)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
      <View style={[styles.rim, { borderRadius: radius }]} />
      <View style={styles.reflection} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  opaque: { backgroundColor: "#f1faf5" },
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    borderBottomColor: "rgba(181,214,197,0.42)",
  },
  reflection: {
    position: "absolute",
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.64)",
  },
});
