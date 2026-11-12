import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type {
  PlaceResponse,
  RouteResponse,
  RideCapabilities,
  TripView,
  RidePostView,
  PostSource,
  ContributionEstimate,
  RideDiscoveryResults,
  RidePostResponse,
} from "@dike/api-client-ts";
import { RideComposerSheet } from "@/components/RideComposerSheet";
import { DeparturePicker } from "@/components/DeparturePicker";
import {
  Badge,
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Icon,
  RouteCard,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime, money } from "@/core/hooks";
import { theme } from "@/core/theme";
import { RideDiscoveryResults as DiscoveryResults } from "@/components/RideDiscoveryResults";
import { RouteMapSurface } from "@/components/RouteMapSurface";
import { useSession } from "@/core/session";
import { JourneyHeader } from "@/components/JourneyHeader";
import { DestinationSelection } from "@/components/DestinationSelection";
import { RideOptionsPanel, travelTime } from "@/components/RideOptionsPanel";
import { PickupMap } from "@/components/PickupMap";
import {
  usePlaces,
  useResolvePlace,
  currentCoordinates,
  samePlace,
} from "@/core/places";

const localDeparture = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

function ComposerPage({
  step,
  children,
  onBack,
  map,
  footer,
}: PropsWithChildren<{
  step: number;
  onBack: () => void;
  map?: ReactNode;
  footer?: ReactNode;
}>) {
  return (
    <SafeAreaView style={[styles.page, step === 0 && styles.destinationPage]}>
      {step !== 0 ? (
        <JourneyHeader
          title={
            step === 0
              ? "Bạn muốn đi đâu?"
              : step === 1
                ? "Chuyến đi của bạn"
                : "Kết quả phù hợp"
          }
          subtitle={
            step === 0
              ? "Chọn điểm đến, kiểm tra điểm đi"
              : step === 1
                ? "Chọn xe và giờ khởi hành"
                : "Kết nối với người cùng đường"
          }
          onBack={onBack}
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {step === 1 ? (
          <View style={styles.flex} testID="composer-map-stage">
            <View style={StyleSheet.absoluteFill} testID="composer-fixed-map">
              {map}
            </View>
            <RideComposerSheet testID="ride-options-sheet">
              {children}
            </RideComposerSheet>
          </View>
        ) : (
          <ScrollView
            testID="composer-scroll"
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              step === 0 ? styles.destinationContent : styles.flowContent
            }
          >
            {children}
          </ScrollView>
        )}
        {footer ? <View style={styles.flowFooter}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  checkButtonInset: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  destinationPage: { backgroundColor: theme.colors.surface },
  destinationContent: {
    paddingBottom: 40,
    gap: theme.spacing.sm,
  },
  roleBar: {
    flexDirection: "row",
    backgroundColor: "#f1f5f3",
    borderRadius: 28,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e3eae6",
  },
  roleTab: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  roleTabActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  roleTabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  roleTabText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.inkMuted,
  },
  roleTabTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  optionsContent: { flexGrow: 1 },
  optionsSheet: {
    marginTop: -theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopStartRadius: theme.radius.xl,
    borderTopEndRadius: theme.radius.xl,
    flexGrow: 1,
  },
  flowMap: {
    flexShrink: 0,
    minHeight: theme.journey.vehicleHeight,
  },
  flowFooter: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  flowContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  routeSummary: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  selectedAddress: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
  },
  vehicleLabel: { fontWeight: "700", textAlign: "center", fontSize: 14 },
  centerState: { alignItems: "center", paddingVertical: theme.spacing.xl },
  centerText: { textAlign: "center" },
  detailsForm: { gap: theme.spacing.md },
  disabled: { opacity: 0.4 },
  divider: {
    backgroundColor: theme.colors.border,
    height: 1,
    marginVertical: theme.spacing.sm,
  },
  draftCard: { gap: theme.spacing.md },
  draftMap: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    height: 112,
    overflow: "hidden",
    width: 112,
  },
  routePreviewMap: {
    borderRadius: 0,
    height: "100%",
    width: "100%",
  },
  mapFallback: {
    alignItems: "center",
    flex: 1,
    gap: theme.spacing.xs,
    justifyContent: "center",
  },
  mapRetry: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  draftTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewCaption: { color: theme.colors.inkMuted, fontSize: 12 },
  previewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  previewIdentity: { flex: 1, gap: theme.spacing.xs },
  previewInline: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  previewName: { color: theme.colors.ink, fontSize: 16, fontWeight: "800" },
  previewRole: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  previewRoleText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  previewRoute: { flexDirection: "row", gap: theme.spacing.sm },
  previewRouteLabels: { flex: 1, gap: theme.spacing.md },
  previewRouteRail: { alignItems: "center", paddingVertical: 4, width: 12 },
  previewRouteDot: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    height: theme.spacing.sm,
    width: theme.spacing.sm,
  },
  previewRouteLine: {
    backgroundColor: theme.colors.primary,
    flex: 1,
    marginVertical: 4,
    minHeight: 32,
    width: 1,
  },
  previewRouteText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  previewStop: { gap: theme.spacing.xs },
  editPill: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: theme.spacing.sm,
  },
  editText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800" },
  estimate: {
    alignItems: "center",
    backgroundColor: theme.colors.passengerSoft,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  estimateText: {
    color: theme.colors.passengerInk,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  flex: { flex: 1 },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  needGrid: {
    alignItems: "stretch",
    gap: theme.spacing.md,
  },
  pressed: { opacity: 0.76 },
  page: { backgroundColor: theme.colors.canvas, flex: 1 },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  routeForm: { gap: theme.spacing.md },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
  },
  sectionIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  seatColumn: { flex: 1, gap: theme.spacing.sm },
  stateIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  stepper: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
  },
  stepperButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    minWidth: 56,
  },
  stepperNumber: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  stepperUnit: { color: theme.colors.inkMuted, fontSize: 12 },
  stepperValue: { alignItems: "center" },
  success: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  successText: {
    color: theme.colors.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  vehicleColumn: { flex: 1.35, gap: theme.spacing.sm },
  vehicleChoice: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: theme.journey.vehicleHeight,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    flex: 1,
    justifyContent: "center",
  },
  vehicleChoiceSelected: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  vehicleChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  swap: { alignItems: "center", flexDirection: "row", gap: theme.spacing.sm },
  swapButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  swapLine: { backgroundColor: theme.colors.border, flex: 1, height: 1 },
  swapText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800" },
});

function TripRouteMap({
  route,
  large = false,
}: {
  route: RouteResponse;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const routePoints = route.geometry?.length
    ? route.geometry
    : [route.origin, route.destination];
  const geometry = routePoints.filter(
    (point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 85 &&
      Math.abs(point.longitude) <= 180,
  );

  return (
    <View
      accessibilityLabel="Bản đồ tuyến đường thực tế"
      style={large ? styles.flex : styles.draftMap}
    >
      {failed || geometry.length < 2 ? (
        <View style={styles.mapFallback}>
          <Icon name="map-outline" size={24} color={theme.colors.inkMuted} />
          <Text style={ui.muted}>Chưa tải được bản đồ</Text>
          <Text
            accessibilityLabel="Thử tải lại bản đồ"
            accessibilityRole="button"
            onPress={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
            style={styles.mapRetry}
          >
            Thử lại
          </Text>
        </View>
      ) : (
        <RouteMapSurface
          key={attempt}
          geometry={geometry}
          onError={() => setFailed(true)}
          interactive={large}
        />
      )}
    </View>
  );
}

function parsedAssistantPlace(value?: string): PlaceResponse | undefined {
  if (!value) return undefined;
  try {
    const place = JSON.parse(value) as PlaceResponse;
    return place.placeRef && place.displayLabel ? place : undefined;
  } catch {
    return undefined;
  }
}

export default function CreateTrip() {
  const params = useLocalSearchParams<{
    mode?: string;
    review?: string;
    origin?: string;
    destination?: string;
    departure?: string;
    seats?: string;
  }>();
  const initialMode = params.mode;
  const assistantOrigin = parsedAssistantPlace(params.origin);
  const assistantDestination = parsedAssistantPlace(params.destination);
  const assistantReview =
    params.review === "assistant" && !!assistantOrigin && !!assistantDestination;
  const api = useMobileApi();
  const client = useQueryClient();
  const { session } = useSession();
  const [mode, setMode] = useState<"driver" | "passenger">(
    initialMode === "passenger" ? "passenger" : "driver",
  );
  const [step, setStep] = useState(assistantReview ? 1 : 0);
  const [activePlace, setActivePlace] = useState<"origin" | "destination">(
    "destination",
  );
  const [mapTarget, setMapTarget] = useState<"origin" | "destination">(
    "origin",
  );
  const [mapSeed, setMapSeed] = useState<PlaceResponse>();
  const [scheduled, setScheduled] = useState(assistantReview);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [routeDetails, setRouteDetails] = useState(false);
  const places = usePlaces();
  const resolvePlace = useResolvePlace();
  const pickupInitialized = useRef(false);
  const pickupManuallyEdited = useRef(false);
  const transitionLocked = useRef(false);
  const [origin, setOrigin] = useState<PlaceResponse | undefined>(assistantOrigin);
  const [destination, setDestination] = useState<PlaceResponse | undefined>(
    assistantDestination,
  );
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleMode, setVehicleMode] = useState("MOTORBIKE");
  const [departure, setDeparture] = useState(params.departure ?? "");
  const [seats, setSeats] = useState(params.seats ?? "1");
  const [contribution, setContribution] = useState("1000");
  const [contributionEdited, setContributionEdited] = useState(false);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [route, setRoute] = useState<RouteResponse>();
  const [confirm, setConfirm] = useState(false);
  const [started, setStarted] = useState(false);
  const [estimate, setEstimate] = useState<ContributionEstimate>();
  const [sentPostIds, setSentPostIds] = useState(new Set<string>());
  const [responsePost, setResponsePost] = useState<RidePostView>();
  const [responseMessage, setResponseMessage] = useState("");
  const routeGeneration = useRef(0);
  const assistantReviewStarted = useRef(false);
  const progress = useRef<
    | {
        key: string;
        departure: string;
        trip?: TripView;
        source?: { id: string; version: number };
        post?: RidePostView;
        opened?: boolean;
      }
    | undefined
  >(undefined);
  const caps = useQuery({
    queryKey: ["mobile-capabilities"],
    queryFn: () => api.call<RideCapabilities>("/ride-capabilities"),
  });
  const vehicle = caps.data?.vehicles.find((v) => v.id === vehicleId);
  const restorePickup = useMutation({
    mutationFn: resolvePlace,
    onSuccess: (place) => {
      if (!pickupManuallyEdited.current) setOrigin(place);
    },
  });
  useEffect(() => {
    if (!places.isSuccess || pickupInitialized.current) return;
    if (!places.preferences.pickup) {
      pickupInitialized.current = true;
      return;
    }
    restorePickup.mutate(places.preferences.pickup);
    // Only restore once; a user's manual edit must never be overwritten.
    pickupInitialized.current = true;
  }, [places.isSuccess]);
  useEffect(() => {
    if (mode !== "driver" || vehicleId || !caps.data?.vehicles.length) return;
    const defaultVehicle =
      caps.data.vehicles.find((item) => item.type !== "CAR") ??
      caps.data.vehicles[0];
    setVehicleId(defaultVehicle.id);
    setVehicleMode(defaultVehicle.type === "CAR" ? "CAR" : "MOTORBIKE");
  }, [caps.data?.vehicles, mode, vehicleId]);
  useEffect(() => {
    const maximum =
      mode === "driver"
        ? (vehicle?.passengerCapacity ?? 1)
        : vehicleMode === "MOTORBIKE"
          ? 1
          : 3;
    setSeats((value) =>
      String(Math.min(Math.max(1, Number(value) || 1), maximum)),
    );
  }, [mode, vehicle?.passengerCapacity, vehicleMode]);
  const preview = useQuery({
    queryKey: [
      "composer-route",
      session?.user.id,
      origin?.placeRef,
      destination?.placeRef,
      vehicleMode,
    ],
    enabled: step === 1 && !!origin && !!destination,
    staleTime: 60_000,
    queryFn: () =>
      api.call<RouteResponse>("/routing/routes", "POST", {
        originPlaceRef: origin!.placeRef,
        destinationPlaceRef: destination!.placeRef,
        vehicleMode,
      }),
  });
  const previewEstimate = useQuery({
    queryKey: ["composer-estimate", preview.data?.id, seats],
    enabled: step === 1 && !!preview.data,
    queryFn: () =>
      api.call<ContributionEstimate>("/routing/estimates", "POST", {
        routeSnapshotId: preview.data!.id,
        sharedDistanceMeters: preview.data!.distanceMeters,
        passengerSeats: Math.max(1, Number(seats) || 1),
      }),
  });
  useEffect(() => {
    if (!contributionEdited && mode === "driver" && previewEstimate.data)
      setContribution(String(previewEstimate.data.suggestedPerKmVnd));
  }, [contributionEdited, mode, previewEstimate.data]);
  const calc = useMutation({
    mutationFn: async () => {
      const generation = ++routeGeneration.current;
      if (!origin || !destination)
        throw new Error("Chọn điểm đi và điểm đến từ kết quả tìm kiếm.");
      if (samePlace(origin, destination))
        throw new Error("Điểm đi và đến phải khác nhau.");
      const chosenDeparture = scheduled
        ? departure
        : localDeparture(new Date(Date.now() + 5 * 60_000));
      const t = new Date(chosenDeparture.replace(" ", "T")).getTime();
      if (!Number.isFinite(t) || t <= Date.now())
        throw new Error(
          "Chọn giờ khởi hành trong tương lai hoặc dùng các gợi ý chọn nhanh.",
        );
      const calculated =
        preview.data && Date.parse(preview.data.expiresAt) > Date.now()
          ? preview.data
          : await api.call<RouteResponse>("/routing/routes", "POST", {
              originPlaceRef: origin.placeRef,
              destinationPlaceRef: destination.placeRef,
              vehicleMode,
            });
      if (generation === routeGeneration.current) {
        const suggested = await api
          .call<ContributionEstimate>("/routing/estimates", "POST", {
            routeSnapshotId: calculated.id,
            sharedDistanceMeters: calculated.distanceMeters,
            passengerSeats: Math.max(1, Number(seats) || 1),
          })
          .catch(() => undefined);
        if (generation !== routeGeneration.current) return;
        setRoute(calculated);
        setDeparture(chosenDeparture);
        setEstimate(suggested);
        if (mode === "driver" && suggested && !contributionEdited)
          setContribution(String(suggested.suggestedPerKmVnd));
        setStep(2);
        discovery.mutate({
          routeId: calculated.id,
          role: mode,
          departureAt: new Date(t).toISOString(),
          seats: Math.max(1, Number(seats) || 1),
        });
      }
    },
  });
  const discovery = useMutation({
    mutationFn: (input: {
      routeId: string;
      role: string;
      departureAt: string;
      seats: number;
    }) => api.call<RideDiscoveryResults>("/ride-discovery", "POST", input),
  });
  useEffect(() => {
    if (
      !assistantReview ||
      assistantReviewStarted.current ||
      !preview.data ||
      calc.isPending
    )
      return;
    assistantReviewStarted.current = true;
    calc.mutate();
  }, [assistantReview, preview.data, calc.isPending]);
  const sendResponse = useMutation({
    mutationFn: async () => {
      if (!responsePost) throw new Error("Chọn một hành trình phù hợp.");
      let pickupCheckId: string | undefined;
      if (responsePost.type === "OFFER_RIDE") {
        const check = await api.call<{ id: string }>(
          `/ride-posts/${encodeURIComponent(responsePost.id)}/pickup-checks`,
          "POST",
          {
            useDriverPickup: true,
            useDriverDropoff: true,
          },
        );
        pickupCheckId = check.id;
      }
      return api.call<RidePostResponse>(
        `/ride-posts/${encodeURIComponent(responsePost.id)}/responses`,
        "POST",
        { message: responseMessage.trim(), pickupCheckId },
        randomUUID(),
      );
    },
    onSuccess: () => {
      const postId = responsePost!.id;
      setSentPostIds((current) => new Set(current).add(postId));
      setResponsePost(undefined);
      setResponseMessage("");
      void client.invalidateQueries({ queryKey: ["mobile-response-inbox"] });
    },
  });
  const publish = useMutation({
    mutationFn: async () => {
      if (!route) throw new Error("Hãy tính tuyến đường trước.");
      if (!progress.current) {
        if (Date.parse(route.expiresAt) <= Date.now())
          throw new Error("Tuyến đường đã hết hạn. Hãy tính lại.");
        if (!Number.isInteger(Number(contribution)) || Number(contribution) < 0)
          throw new Error("Mức chia sẻ chi phí không hợp lệ.");
        if (
          mode === "driver" &&
          (!vehicle ||
            !caps.data?.canCreateTrip ||
            !Number.isInteger(Number(seats)) ||
            Number(seats) < 1 ||
            Number(seats) > vehicle.passengerCapacity)
        )
          throw new Error("Chọn phương tiện đã duyệt và số ghế phù hợp.");
        const time = new Date(departure.replace(" ", "T")).getTime();
        if (!Number.isFinite(time) || time <= Date.now())
          throw new Error("Giờ khởi hành phải trong tương lai.");
        progress.current = {
          key: randomUUID(),
          departure: new Date(time).toISOString(),
        };
        setStarted(true);
      }
      const p = progress.current;
      const audience = visibility === "DRAFT" ? "PUBLIC" : visibility;
      if (mode === "driver") {
        p.trip ??= await api.call<TripView>(
          "/trips",
          "POST",
          {
            vehicleId: vehicle!.id,
            routeId: route.id,
            departureAt: p.departure,
            originLabel: route.origin.publicAreaLabel,
            destinationLabel: route.destination.publicAreaLabel,
            offeredSeats: Number(seats),
            contributionPerKm: Number(contribution),
            detourMeters: 1000,
            detourSeconds: 300,
            visibility: audience,
            communityId: "",
          },
          p.key,
        );
        p.source = { id: p.trip.id, version: p.trip.version };
      } else
        p.source ??= await api.call<PostSource>(
          "/ride-post-sources",
          "POST",
          {
            routeId: route.id,
            departureAt: p.departure,
            arrivalAt: new Date(
              Date.parse(p.departure) +
                (Math.max(60, route.durationSeconds) + 3600) * 1000,
            ).toISOString(),
          },
          p.key,
        );
      p.post ??= await api.call<RidePostView>(
        "/ride-posts",
        "POST",
        {
          type: mode === "driver" ? "OFFER_RIDE" : "NEED_RIDE",
          sourceId: p.source.id,
          sourceVersion: p.source.version,
          visibility: audience,
          note,
        },
        p.key,
      );
      if (visibility !== "DRAFT") {
        if (mode === "driver" && !p.opened) {
          await api.call(
            `/trips/${p.trip!.id}/open`,
            "POST",
            { version: p.trip!.version },
            p.key,
          );
          p.opened = true;
        } else if (mode !== "driver")
          p.post = await api.call<RidePostView>(
            `/ride-posts/${p.post.id}/publish`,
            "POST",
            { version: p.post.version },
            p.key,
          );
      }
      return p.post;
    },
    onSuccess: (post) => {
      void client.invalidateQueries();
      router.replace({ pathname: "/posts/[id]", params: { id: post.id } });
    },
    onError: () => {
      if (
        progress.current &&
        !progress.current.source &&
        !progress.current.trip &&
        !progress.current.post
      ) {
        progress.current = undefined;
        setStarted(false);
      }
    },
  });
  const change = () => {
    routeGeneration.current++;
    setRoute(undefined);
    setEstimate(undefined);
    discovery.reset();
    calc.reset();
  };
  const hasValidRoute =
    !!origin && !!destination && !samePlace(origin, destination);

  const back = useCallback(() => {
    if (started || transitionLocked.current) return;
    if (step === 2) setStep(1);
    else if (step === 1 || step === 3) setStep(0);
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [started, step]);
  usePreventRemove(
    Platform.OS === "ios" && step > 0 && !started && !!session?.authenticated,
    back,
  );
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        if (step === 0 && !started) return false;
        back();
        return true;
      });
      return () => listener.remove();
    }, [back, started, step]),
  );
  const remember = useMutation({
    onMutate: () => {
      transitionLocked.current = true;
    },
    onSettled: () => {
      transitionLocked.current = false;
    },
    mutationFn: async (place: PlaceResponse) => {
      await places.remember(place, mapTarget === "origin");
      if (mapTarget === "origin") {
        setOrigin(place);
        pickupManuallyEdited.current = true;
        setStep(destination && !samePlace(place, destination) ? 1 : 0);
      } else {
        setDestination(place);
        setStep(0);
      }
      change();
    },
  });
  const saveRecent = useMutation({
    mutationFn: (place: PlaceResponse) => places.remember(place),
  });
  const openMap = useMutation({
    mutationFn: async () => {
      const selected = activePlace === "origin" ? origin : destination;
      return (
        selected ??
        (await resolvePlace(
          places.preferences.pickup ??
            origin ??
            destination ??
            (await currentCoordinates()),
        ))
      );
    },
    onSuccess: (place) => {
      setMapTarget(activePlace);
      setMapSeed(place);
      setStep(3);
    },
  });
  const select = (
    place: PlaceResponse | undefined,
    target: "origin" | "destination",
  ) => {
    if (target === "origin") {
      pickupManuallyEdited.current = true;
      restorePickup.reset();
      setOrigin(place);
    } else setDestination(place);
    change();
    if (place) {
      saveRecent.mutate(place);
      setActivePlace("destination");
    }
  };

  if (step === 3 && mapSeed)
    return (
      <SafeAreaView style={styles.page}>
        <JourneyHeader
          title={
            mapTarget === "destination"
              ? "Chọn điểm đến"
              : mode === "driver"
                ? "Điểm xuất phát"
                : "Điểm đón của bạn"
          }
          onBack={back}
        />
        <PickupMap
          key={`${mapSeed.latitude}:${mapSeed.longitude}`}
          place={mapSeed}
          pending={remember.isPending}
          note={note}
          onNoteChange={mapTarget === "origin" ? setNote : undefined}
          title={
            mapTarget === "destination"
              ? "Xác nhận điểm đến"
              : mode === "driver"
                ? "Xác nhận điểm xuất phát"
                : "Xác nhận điểm đón"
          }
          onSearch={() => {
            setActivePlace(mapTarget);
            setStep(0);
          }}
          onConfirm={(place) => remember.mutate(place)}
        />
        <ErrorText error={remember.error} />
      </SafeAreaView>
    );

  return (
    <ComposerPage
      key={step}
      step={step}
      onBack={back}
      map={
        step === 1 && preview.data ? (
          <TripRouteMap route={preview.data} large />
        ) : undefined
      }
      footer={
        step === 0 ? (
          <>
            {hasValidRoute ? (
              <Button
                label={
                  mode === "driver"
                    ? "Kiểm tra điểm xuất phát"
                    : "Kiểm tra điểm đón"
                }
                icon="navigate-outline"
                onPress={() => {
                  setMapTarget("origin");
                  setMapSeed(origin);
                  setStep(3);
                }}
              />
            ) : null}
            <View style={styles.roleBar}>
              {(["driver", "passenger"] as const).map((value) => {
                const selected = mode === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={
                      value === "driver"
                        ? "Chuyển sang chế độ Tôi chở"
                        : "Chuyển sang chế độ Tôi đi ké"
                    }
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.roleTab,
                      selected && styles.roleTabActive,
                      pressed && styles.roleTabPressed,
                    ]}
                    onPress={() => {
                      setMode(value);
                      change();
                    }}
                  >
                    <Icon
                      name={
                        value === "driver"
                          ? selected
                            ? "car-sport"
                            : "car-sport-outline"
                          : selected
                            ? "person"
                            : "person-outline"
                      }
                      size={20}
                      color={selected ? "#ffffff" : theme.colors.inkMuted}
                    />
                    <Text
                      style={[
                        styles.roleTabText,
                        selected && styles.roleTabTextActive,
                      ]}
                    >
                      {value === "driver" ? "Tôi chở" : "Tôi đi ké"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : step === 1 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hẹn giờ khởi hành"
              style={styles.selectedAddress}
              onPress={() => setScheduleOpen(true)}
            >
              <Icon name="time-outline" />
              <View style={styles.flex}>
                <Text style={ui.label}>
                  {scheduled &&
                  departure &&
                  Number.isFinite(Date.parse(departure.replace(" ", "T")))
                    ? dateTime(
                        new Date(departure.replace(" ", "T")).toISOString(),
                      )
                    : "Đi sớm · khoảng 5 phút nữa"}
                </Text>
                <Text style={ui.muted}>Bấm để hẹn giờ</Text>
              </View>
              <Icon name="chevron-forward" size={18} />
            </Pressable>
            <ErrorText error={calc.error} />
            <Button
              label={
                mode === "driver" ? "Tìm người đi cùng" : "Tìm chuyến phù hợp"
              }
              icon="navigate-outline"
              pending={calc.isPending}
              disabled={
                started ||
                !hasValidRoute ||
                (mode === "driver" && (!vehicle || !caps.data?.canCreateTrip))
              }
              onPress={() => calc.mutate()}
            />
          </>
        ) : undefined
      }
    >
      {step === 0 ? (
        <>
          <DestinationSelection
            origin={origin}
            destination={destination}
            active={activePlace}
            onActive={setActivePlace}
            onSelect={select}
            onMap={() => openMap.mutate()}
            onBack={back}
          />
          {restorePickup.isError && !origin ? (
            <>
              <Text accessibilityLiveRegion="polite" style={ui.muted}>
                Chưa khôi phục được điểm đi đã lưu. Bạn có thể thử lại hoặc chọn
                địa chỉ khác.
              </Text>
              <Button
                label="Thử lại điểm đi đã lưu"
                variant="secondary"
                pending={restorePickup.isPending}
                onPress={() => {
                  if (places.preferences.pickup)
                    restorePickup.mutate(places.preferences.pickup);
                }}
              />
            </>
          ) : null}
          <ErrorText error={openMap.error || saveRecent.error} />
          {origin && destination && !hasValidRoute ? (
            <Text accessibilityLiveRegion="polite" style={ui.muted}>
              Điểm đi và điểm đến đang trùng nhau. Hãy chọn địa điểm khác.
            </Text>
          ) : null}
          {openMap.isPending ? (
            <Text accessibilityLiveRegion="polite" style={ui.muted}>
              Đang mở bản đồ…
            </Text>
          ) : null}
        </>
      ) : null}
      {step === 1 && hasValidRoute ? (
        <RideOptionsPanel
          mode={mode}
          origin={origin.displayLabel}
          destination={destination.displayLabel}
          onEditRoute={() => setStep(0)}
          onRouteDetails={() => setRouteDetails(true)}
          disabled={started || calc.isPending}
          options={
            mode === "driver"
              ? (caps.data?.vehicles ?? []).map((v) => ({
                  id: v.id,
                  title: v.type === "CAR" ? "Ô tô" : "Xe máy",
                  description: `${v.displayName} · ${v.passengerCapacity} chỗ`,
                  label: `${v.displayName}, ${v.passengerCapacity} chỗ`,
                  icon:
                    v.type === "CAR" ? "car-sport-outline" : "bicycle-outline",
                  selected: vehicleId === v.id,
                  price:
                    vehicleId === v.id
                      ? money(Number(contribution) || 0)
                      : undefined,
                  priceUnit: "/km",
                  onPress: () => {
                    setVehicleId(v.id);
                    setVehicleMode(v.type === "CAR" ? "CAR" : "MOTORBIKE");
                    change();
                  },
                }))
              : [
                  {
                    id: "MOTORBIKE",
                    title: "Xe máy",
                    description: "Gọn nhẹ · 1 người",
                    label: "Xe máy",
                    icon: "bicycle-outline",
                    selected: vehicleMode === "MOTORBIKE",
                    price:
                      vehicleMode === "MOTORBIKE" && previewEstimate.data
                        ? money(previewEstimate.data.amountVnd)
                        : undefined,
                    onPress: () => {
                      setVehicleMode("MOTORBIKE");
                      change();
                    },
                  },
                  {
                    id: "CAR",
                    title: "Ô tô",
                    description: "Thoải mái · tối đa 3 người",
                    label: "Ô tô",
                    icon: "car-sport-outline",
                    selected: vehicleMode === "CAR",
                    price:
                      vehicleMode === "CAR" && previewEstimate.data
                        ? money(previewEstimate.data.amountVnd)
                        : undefined,
                    onPress: () => {
                      setVehicleMode("CAR");
                      change();
                    },
                  },
                ]
          }
          seats={Math.max(1, Number(seats) || 1)}
          maximum={
            mode === "driver"
              ? (vehicle?.passengerCapacity ?? 1)
              : vehicleMode === "MOTORBIKE"
                ? 1
                : 3
          }
          onSeatsChange={(value) => {
            setSeats(String(value));
            change();
          }}
          status={
            <>
              {preview.isPending ? (
                <Text accessibilityLiveRegion="polite" style={ui.muted}>
                  Đang tính tuyến đường…
                </Text>
              ) : null}
              <ErrorText
                error={
                  preview.error ||
                  previewEstimate.error ||
                  (mode === "driver" ? caps.error : undefined)
                }
              />
              {preview.isError ? (
                <Button
                  label="Thử tính lại tuyến"
                  variant="secondary"
                  onPress={() => {
                    void preview.refetch();
                  }}
                />
              ) : null}
              {mode === "driver" && caps.isPending ? (
                <Text accessibilityLiveRegion="polite" style={ui.muted}>
                  Đang tải phương tiện của bạn…
                </Text>
              ) : null}
              {mode === "driver" && caps.isError ? (
                <Button
                  label="Thử tải lại phương tiện"
                  variant="secondary"
                  onPress={() => {
                    void caps.refetch();
                  }}
                />
              ) : null}
              {mode === "driver" &&
              caps.data &&
              (!caps.data.canCreateTrip || !caps.data.vehicles.length) ? (
                <>
                  <Text style={ui.muted}>
                    {caps.data.message ||
                      "Bạn cần phương tiện được duyệt để chia sẻ chuyến đi."}
                  </Text>
                  <Button
                    label="Hoàn tất hồ sơ tài xế"
                    variant="secondary"
                    onPress={() => router.push("/verification")}
                  />
                </>
              ) : null}
            </>
          }
          advanced={
            <>
              {mode === "driver" ? (
                <Field
                  label="Mức chia sẻ dự kiến (₫/km)"
                  value={contribution}
                  editable={!started}
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setContribution(value);
                    setContributionEdited(true);
                  }}
                />
              ) : null}
              {previewEstimate.data ? (
                <Text style={ui.muted}>
                  Tham khảo: {money(previewEstimate.data.suggestedPerKmVnd)}/km
                  · khoảng {money(previewEstimate.data.amountVnd)}
                </Text>
              ) : null}
              <Field
                label="Lời nhắn (không bắt buộc)"
                value={note}
                onChangeText={setNote}
                editable={!started}
                multiline
                maxLength={500}
                placeholder="Ví dụ: Mình đón ở cổng chính…"
              />
            </>
          }
        />
      ) : null}
      {route && step === 2 ? (
        <>
          <View style={styles.resultsHeader}>
            <View style={styles.flex}>
              <Text style={ui.sectionTitle}>Kết quả phù hợp</Text>
            </View>
            <Badge label={`${discovery.data?.items.length ?? 0} kết quả`} />
          </View>
          {sendResponse.isSuccess ? (
            <View style={styles.success}>
              <Icon name="checkmark-circle" />
              <Text accessibilityLiveRegion="polite" style={styles.successText}>
                Đã gửi yêu cầu. Bài đang soạn chưa được đăng.
              </Text>
            </View>
          ) : null}
          {discovery.isPending ? (
            <Card style={styles.centerState}>
              <View style={styles.stateIcon}>
                <Icon name="search" size={28} />
              </View>
              <Text style={ui.sectionTitle}>Đang tìm người cùng đường…</Text>
              <Text style={[ui.muted, styles.centerText]}>
                Diké đang so khớp tuyến đường và thời gian của bạn.
              </Text>
            </Card>
          ) : discovery.isError ? (
            <Card style={styles.centerState}>
              <View style={styles.stateIcon}>
                <Icon name="cloud-offline-outline" size={28} />
              </View>
              <Text style={ui.sectionTitle}>Chưa tải được kết quả</Text>
              <ErrorText error={discovery.error} />
              <Button
                label="Thử tìm lại"
                variant="secondary"
                onPress={() =>
                  discovery.mutate({
                    routeId: route.id,
                    role: mode,
                    departureAt: new Date(
                      departure.replace(" ", "T"),
                    ).toISOString(),
                    seats: Math.max(1, Number(seats) || 1),
                  })
                }
              />
            </Card>
          ) : discovery.data?.items.length ? (
            <DiscoveryResults
              items={discovery.data.items}
              sentPostIds={sentPostIds}
              onSelect={(post) => {
                sendResponse.reset();
                setResponseMessage(note.slice(0, 300));
                setResponsePost(post);
              }}
            />
          ) : (
            <Card style={styles.centerState}>
              <View style={styles.stateIcon}>
                <Icon name="search-outline" size={28} />
              </View>
              <Text style={ui.sectionTitle}>Chưa tìm thấy người phù hợp</Text>
              <Text style={[ui.muted, styles.centerText]}>
                Bạn có thể điều chỉnh tìm kiếm hoặc đăng hành trình.
              </Text>
              <Button
                label="Điều chỉnh tìm kiếm"
                variant="secondary"
                icon="options-outline"
                disabled={started}
                onPress={() => setStep(1)}
              />
            </Card>
          )}
          <Card style={styles.draftCard}>
            <View style={styles.draftTop}>
              <Badge
                label={`${(route.distanceMeters / 1000).toFixed(1)} km · ${Math.ceil(route.durationSeconds / 60)} phút`}
              />
              <Pressable
                accessibilityLabel="Chỉnh sửa thông tin"
                accessibilityRole="button"
                disabled={started}
                onPress={() => setStep(1)}
                style={styles.editPill}
              >
                <Icon name="pencil" size={16} />
                <Text style={styles.editText}>Chỉnh sửa</Text>
              </Pressable>
            </View>
            <View style={styles.previewHeader}>
              <Avatar
                userId={session?.user.id}
                name={session?.user.displayName || "Bạn"}
                uri={session?.user.avatarUrl}
                size={40}
              />
              <View style={styles.previewIdentity}>
                <Text userId={session?.user.id} style={styles.previewName}>
                  {session?.user.displayName || "Bài đăng của bạn"}
                </Text>
                <View style={styles.previewInline}>
                  <Text style={styles.previewCaption}>
                    {visibility === "PUBLIC"
                      ? "Hành trình công khai"
                      : visibility === "FRIENDS"
                        ? "Hành trình bạn bè"
                        : "Bản nháp"}
                  </Text>
                  <Icon
                    name="globe-outline"
                    size={14}
                    color={theme.colors.inkMuted}
                  />
                </View>
              </View>
              <View style={styles.previewRole}>
                <Icon
                  name="car-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.previewRoleText}>
                  {mode === "driver" ? "Tôi chở" : "Tôi đi ké"}
                </Text>
              </View>
            </View>
            <View style={styles.previewRoute}>
              <View style={styles.previewRouteRail}>
                <View style={styles.previewRouteDot} />
                <View style={styles.previewRouteLine} />
                <View style={styles.previewRouteDot} />
              </View>
              <View style={styles.previewRouteLabels}>
                <View style={styles.previewStop}>
                  <Text style={styles.previewCaption}>Điểm đi</Text>
                  <Text style={styles.previewRouteText}>
                    {route.origin.displayLabel}
                  </Text>
                </View>
                <View style={styles.previewStop}>
                  <Text style={styles.previewCaption}>Điểm đến</Text>
                  <Text style={styles.previewRouteText}>
                    {route.destination.displayLabel}
                  </Text>
                </View>
              </View>
              <TripRouteMap route={route} />
            </View>
            <View style={styles.metaRow}>
              <Icon name="calendar-outline" size={18} />
              <Text style={ui.muted}>
                {dateTime(new Date(departure.replace(" ", "T")).toISOString())}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Icon
                name={
                  mode === "driver" ? "car-sport-outline" : "people-outline"
                }
                size={18}
              />
              <Text style={ui.muted}>
                {mode === "driver"
                  ? `${seats} chỗ · ${money(Number(contribution))}/km`
                  : `${seats} chỗ cần · ${vehicleMode === "CAR" ? "Ô tô" : "Xe máy"}`}
              </Text>
            </View>
            {estimate ? (
              <View style={styles.estimate}>
                <Icon name="sparkles-outline" size={18} />
                <Text style={styles.estimateText}>
                  Gợi ý: {money(estimate.suggestedPerKmVnd)}/km · khoảng{" "}
                  {money(estimate.amountVnd)}
                </Text>
              </View>
            ) : null}
            <View style={ui.wrap}>
              {[
                ["PUBLIC", "Công khai"],
                ["FRIENDS", "Bạn bè"],
                ["DRAFT", "Bản nháp"],
              ].map(([v, l]) => (
                <Chip
                  key={v}
                  label={l}
                  selected={visibility === v}
                  onPress={started ? undefined : () => setVisibility(v)}
                />
              ))}
            </View>
            <Button
              label={
                visibility === "DRAFT"
                  ? "Lưu bản nháp của tôi"
                  : "Đăng bài của tôi"
              }
              icon={
                visibility === "DRAFT" ? "bookmark-outline" : "send-outline"
              }
              onPress={() => setConfirm(true)}
            />
          </Card>
        </>
      ) : null}
      <BottomSheet
        visible={routeDetails}
        title="Tuyến đường của bạn"
        onClose={() => setRouteDetails(false)}
      >
        {origin && destination ? (
          <RouteCard
            origin={origin.displayLabel}
            destination={destination.displayLabel}
          />
        ) : null}
        {preview.data ? (
          <Text style={ui.muted}>
            {(preview.data.distanceMeters / 1000).toFixed(1)} km · khoảng{" "}
            {travelTime(preview.data.durationSeconds)}
          </Text>
        ) : null}
        <Button
          label="Sửa tuyến đường"
          variant="secondary"
          onPress={() => {
            setRouteDetails(false);
            setStep(0);
          }}
        />
      </BottomSheet>
      <BottomSheet
        visible={scheduleOpen}
        title="Hẹn giờ khởi hành"
        onClose={() => setScheduleOpen(false)}
      >
        <View style={ui.wrap}>
          <Chip
            label="Đi sớm · khoảng 5 phút nữa"
            selected={!scheduled}
            onPress={() => {
              setScheduled(false);
              change();
            }}
          />
          <Chip
            label="Hẹn giờ"
            selected={scheduled}
            onPress={() => setScheduled(true)}
          />
        </View>
        {scheduled ? (
          <DeparturePicker
            value={departure}
            disabled={started}
            onChange={(v) => {
              setDeparture(v);
              change();
            }}
          />
        ) : (
          <Text style={ui.muted}>
            Giờ khởi hành sẽ được cập nhật khi bạn tìm chuyến.
          </Text>
        )}
        <Text style={ui.label}>Hoặc chọn nhanh</Text>
        <View style={ui.wrap}>
          {[
            ["30 phút nữa", 30],
            ["1 giờ nữa", 60],
            ["2 giờ nữa", 120],
          ].map(([label, minutes]) => (
            <Chip
              key={label}
              label={String(label)}
              onPress={
                started
                  ? undefined
                  : () => {
                      const selected = new Date(
                        Date.now() + Number(minutes) * 60_000,
                      );
                      selected.setSeconds(0, 0);
                      setDeparture(localDeparture(selected));
                      setScheduled(true);
                      change();
                    }
              }
            />
          ))}
        </View>
        <Button
          label="Xác nhận thời gian"
          disabled={
            scheduled &&
            (!Number.isFinite(Date.parse(departure.replace(" ", "T"))) ||
              Date.parse(departure.replace(" ", "T")) <= Date.now())
          }
          onPress={() => setScheduleOpen(false)}
        />
      </BottomSheet>
      <BottomSheet
        visible={confirm}
        title="Sẵn sàng chia sẻ?"
        onClose={() => {
          if (!publish.isPending) setConfirm(false);
        }}
      >
        <Text style={ui.muted}>
          Thông tin hành trình sẽ được gửi tới Dike với phạm vi hiển thị bạn đã
          chọn.
        </Text>
        <ErrorText error={publish.error} />
        <Button
          label={visibility === "DRAFT" ? "Lưu bản nháp" : "Đăng hành trình"}
          pending={publish.isPending}
          onPress={() => publish.mutate()}
        />
      </BottomSheet>
      <BottomSheet
        visible={!!responsePost}
        title={
          responsePost?.type === "OFFER_RIDE"
            ? "Gửi yêu cầu đi ké?"
            : "Gửi đề nghị chở?"
        }
        onClose={() => {
          if (!sendResponse.isPending) setResponsePost(undefined);
        }}
      >
        <Text style={ui.muted}>
          Gửi tới{" "}
          <Text userId={responsePost?.ownerId}>
            {responsePost?.ownerDisplayName}
          </Text>
          . Bài đang soạn của bạn sẽ chưa được đăng.
        </Text>
        {responsePost ? (
          <RouteCard
            origin={responsePost.originLabel}
            destination={responsePost.destinationLabel}
          />
        ) : null}
        <Field
          label="Lời nhắn (không bắt buộc)"
          value={responseMessage}
          onChangeText={setResponseMessage}
          editable={!sendResponse.isPending}
          multiline
          maxLength={300}
        />
        <ErrorText error={sendResponse.error} />
        <Button
          label="Gửi yêu cầu"
          pending={sendResponse.isPending}
          onPress={() => sendResponse.mutate()}
        />
      </BottomSheet>
    </ComposerPage>
  );
}
