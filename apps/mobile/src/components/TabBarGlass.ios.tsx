import { StyleSheet } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { TabBarGlassFallback } from "./TabBarGlassFallback";
import { useReducedTransparency } from "@/core/accessibility";

export function TabBarGlass() {
  const reduced = useReducedTransparency();
  if (reduced || !isLiquidGlassAvailable()) return <TabBarGlassFallback />;
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      style={styles.glass}
    />
  );
}

const styles = StyleSheet.create({
  glass: { ...StyleSheet.absoluteFill, borderRadius: 38 },
});
