import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedTransparency } from "@/core/accessibility";

export function TabBarGlassFallback() {
  const reduced = useReducedTransparency();
  if (reduced)
    return (
      <View
        pointerEvents="none"
        style={[glass.shell, { backgroundColor: "#f0faf5" }]}
      />
    );
  return (
    <View pointerEvents="none" style={glass.shell}>
      <LinearGradient
        colors={[
          "rgba(255,255,255,.86)",
          "rgba(230,248,239,.48)",
          "rgba(236,251,245,.80)",
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          "rgba(255,255,255,.85)",
          "rgba(255,255,255,0.08)",
          "rgba(255,255,255,.45)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={glass.innerGlow} />
      <View style={glass.rim} />
      <View style={glass.reflection} />
      <View style={glass.bottomGlint} />
    </View>
  );
}

const glass = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFill,
    borderRadius: 38,
    overflow: "hidden",
    backgroundColor: "rgba(235,249,242,.32)",
  },
  innerGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 37,
    margin: 1.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.55)",
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,.92)",
    borderBottomColor: "rgba(156,214,192,.55)",
  },
  reflection: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 1.5,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,1)",
    borderRadius: 1,
  },
  bottomGlint: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 1.5,
    height: 1,
    backgroundColor: "rgba(255,255,255,.45)",
    borderRadius: 1,
  },
});
