import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Index() {
  const { loading, session } = useSession();
  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  return <Redirect href={session?.authenticated ? "/(tabs)" : "/sign-in"} />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: theme.colors.canvas,
    flex: 1,
    justifyContent: "center",
  },
});
