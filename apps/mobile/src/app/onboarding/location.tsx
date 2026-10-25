import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import type { PlaceResponse } from "@dike/api-client-ts";
import {
  usePlaces,
  useResolvePlace,
  currentCoordinates,
  type SavedPlace,
} from "@/core/places";
import { theme } from "@/core/theme";
import { JourneyHeader } from "@/components/JourneyHeader";
import { PlacePicker } from "@/components/PlacePicker";
import { PickupMap } from "@/components/PickupMap";
import { RecentPlaces } from "@/components/RecentPlaces";
import { Button, Card, ErrorText, Icon, Text, ui } from "@/components/ui";

export default function LocationWelcome() {
  const places = usePlaces();
  const resolve = useResolvePlace();
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlaceResponse>();
  const locate = useMutation({
    mutationFn: async (place?: SavedPlace) =>
      resolve(place ?? (await currentCoordinates())),
    onSuccess: setSelected,
  });
  const save = useMutation({
    mutationFn: async (place?: PlaceResponse) => {
      if (place) await places.remember(place, true);
      else await places.skip();
    },
    onSuccess: () => router.replace("/(tabs)"),
  });
  const back = () => {
    if (selected) setSelected(undefined);
    else if (searching) setSearching(false);
    else if (router.canGoBack()) router.back();
    else save.mutate(undefined);
  };
  return (
    <SafeAreaView style={styles.page}>
      <JourneyHeader
        title={
          selected
            ? "Xác nhận vị trí"
            : searching
              ? "Chọn điểm đi"
              : "Chào bạn, mình bắt đầu ở đâu?"
        }
        onBack={back}
      />
      {selected ? (
        <>
          <PickupMap
            place={selected}
            title="Dùng địa chỉ này"
            onSearch={() => {
              setSelected(undefined);
              setSearching(true);
            }}
            pending={save.isPending}
            onConfirm={(place) => save.mutate(place)}
          />
          <ErrorText error={save.error} />
          {save.isPending ? (
            <Text style={ui.muted}>Đang lưu địa chỉ…</Text>
          ) : null}
        </>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {searching ? (
              <>
                <PlacePicker label="Điểm đi" autoFocus onChange={setSelected} />
                <RecentPlaces onSelect={setSelected} />
              </>
            ) : (
              <>
                <View style={styles.welcome}>
                  <View style={styles.illustration}>
                    <Icon name="location" size={64} />
                  </View>
                  <Text accessibilityRole="header" style={styles.heading}>
                    Chọn điểm xuất phát của bạn
                  </Text>
                  <Text style={[ui.muted, styles.center]}>
                    Diké dùng địa chỉ này để điền sẵn điểm đi. Bạn luôn có thể
                    thay đổi trước mỗi hành trình.
                  </Text>
                </View>
                {places.preferences.pickup ? (
                  <Card>
                    <Text style={ui.label}>Địa chỉ lần trước</Text>
                    <Text>{places.preferences.pickup.displayLabel}</Text>
                    <Button
                      label="Dùng địa chỉ lần trước"
                      variant="secondary"
                      pending={locate.isPending}
                      onPress={() => locate.mutate(places.preferences.pickup)}
                    />
                  </Card>
                ) : null}
                <Button
                  label="Dùng vị trí hiện tại"
                  icon="locate-outline"
                  pending={locate.isPending}
                  onPress={() => locate.mutate(undefined)}
                />
                <Button
                  label="Chọn địa chỉ khác"
                  icon="search"
                  variant="secondary"
                  onPress={() => setSearching(true)}
                />
                <Button
                  label="Để sau, khám phá Diké"
                  variant="secondary"
                  pending={save.isPending}
                  onPress={() => save.mutate(undefined)}
                />
              </>
            )}
            <ErrorText error={locate.error || save.error || places.error} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.surface },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  illustration: {
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.pill,
  },
  heading: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  center: { textAlign: "center" },
});
