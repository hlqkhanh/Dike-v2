import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type {
  JourneyConversation,
  PickupCheck,
  PlaceResponse,
  RouteResponse,
  RidePostResponse,
  RidePostView,
  RidePostDraftSource,
} from "@dike/api-client-ts";
import { PostDetailStage } from "@/components/PostDetailStage";
import { ReportSheet } from "@/components/ReportSheet";
import { ResourceState } from "@/components/ResourceState";
import { PlacePicker } from "@/components/PlacePicker";
import {
  BottomSheet,
  Button,
  ErrorText,
  TextInput,
  Icon,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";
import { useSession } from "@/core/session";
import { PostRequestComment } from "@/components/PostRequestComment";
import { splitPlaceLabel } from "@/core/place-label";
import { theme } from "@/core/theme";
export default function PostDetail() {
  const {
    id = "",
    responseId,
    action,
  } = useLocalSearchParams<{
    id: string;
    responseId?: string;
    action?: string;
  }>();
  const api = useMobileApi();
  const client = useQueryClient();
  const publication = useRef<
    | {
        signature: string;
        key: string;
        source?: RidePostDraftSource;
      }
    | undefined
  >(undefined);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [close, setClose] = useState(false);
  const [report, setReport] = useState(false);
  const [sheetExpansion, setSheetExpansion] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectionSignal, setSelectionSignal] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const initialSnap = useRef<0 | 1 | 2>(
    action === "request" || responseId ? 2 : 1,
  ).current;
  const refreshLists = () => {
    for (const key of [
      "mobile-my-posts",
      "mobile-feed",
      "mobile-response-inbox",
      "mobile-active-responses",
      "mobile-trips",
    ])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const { session } = useSession();
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState("");
  const [pickupText, setPickupText] = useState("");
  const [dropoffText, setDropoffText] = useState("");
  const [pickup, setPickup] = useState<PlaceResponse>();
  const [dropoff, setDropoff] = useState<PlaceResponse>();
  const [previewPickup, setPreviewPickup] = useState<PlaceResponse>();
  const [previewDropoff, setPreviewDropoff] = useState<PlaceResponse>();
  const [check, setCheck] = useState<PickupCheck>();
  const [decision, setDecision] = useState<{
    response: RidePostResponse;
    value: string;
  }>();
  const post = useQuery({
    queryKey: ["mobile-post", id],
    queryFn: () => api.post(id),
  });
  const responses = useQuery({
    queryKey: ["mobile-post-responses", id],
    queryFn: () => api.postResponses(id),
    refetchInterval: 10000,
  });
  const data = post.data;
  const own = data?.ownerId === session?.user.id;
  const visibleResponses = (responses.data ?? []).filter(
    (r) =>
      r.status !== "WITHDRAWN" && (own || r.requesterId === session?.user.id),
  );
  const selected = visibleResponses.find((r) => r.id === selectedId);
  const confirmedStatuses = [
    "ACCEPTED",
    "DRIVER_STARTED",
    "DRIVER_ARRIVED",
    "COMPLETED",
  ];
  const confirmedResponses = visibleResponses.filter((r) =>
    confirmedStatuses.includes(r.status),
  );
  const confirmedResponse =
    confirmedResponses.find((r) => r.id === selectedId) ??
    confirmedResponses.find((r) => r.id === responseId) ??
    confirmedResponses[0];
  const active = visibleResponses.some(
    (r) =>
      r.requesterId === session?.user.id &&
      !["REJECTED", "WITHDRAWN"].includes(r.status),
  );
  const viewerPassenger = data?.type === "OFFER_RIDE";
  const requestAccent = viewerPassenger
    ? theme.colors.passengerInk
    : theme.colors.primary;
  const requestSoft = viewerPassenger ? theme.colors.passengerSoft : "#eaf7f0";
  const preview = useQuery<PickupCheck | RouteResponse>({
    queryKey: [
      "post-request-preview",
      id,
      data?.type,
      previewPickup?.placeRef,
      previewDropoff?.placeRef,
    ],
    enabled:
      !!data &&
      !own &&
      !active &&
      (viewerPassenger
        ? !!(previewPickup || previewDropoff)
        : !!(previewPickup && previewDropoff)),
    staleTime: 60_000,
    retry: false,
    queryFn: () =>
      viewerPassenger
        ? api.call<PickupCheck>(`/ride-posts/${id}/pickup-checks`, "POST", {
            pickupPlaceRef: previewPickup?.placeRef,
            dropoffPlaceRef: previewDropoff?.placeRef,
            useDriverPickup: !previewPickup,
            useDriverDropoff: !previewDropoff,
          })
        : api.call<RouteResponse>("/routing/routes", "POST", {
            originPlaceRef: previewPickup!.placeRef,
            destinationPlaceRef: previewDropoff!.placeRef,
            vehicleMode: data?.vehicleType === "CAR" ? "CAR" : "MOTORBIKE",
          }),
  });
  useEffect(() => {
    if (action !== "request" || !data || !responses.isSuccess) return;
    setSheetExpansion((value) => value + 1);
    router.setParams({ action: undefined });
  }, [action, data, responses.isSuccess]);
  const request = useMutation({
    mutationFn: async () => {
      let checked: PickupCheck | undefined;
      if (data?.type === "OFFER_RIDE") {
        checked = await api.call<PickupCheck>(
          `/ride-posts/${id}/pickup-checks`,
          "POST",
          {
            pickupPlaceRef: pickup?.placeRef,
            dropoffPlaceRef: dropoff?.placeRef,
            useDriverPickup: !pickup,
            useDriverDropoff: !dropoff,
          },
        );
        setCheck(checked);
        if (!checked.compatible)
          throw new Error(
            checked.reason || "Địa điểm chưa phù hợp với tuyến đi.",
          );
      }
      const locations =
        data?.type === "NEED_RIDE"
          ? [
              pickup
                ? "Điểm đi: " + splitPlaceLabel(pickup.displayLabel).name
                : "",
              dropoff
                ? "Điểm đến: " + splitPlaceLabel(dropoff.displayLabel).name
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "";
      const requestMessage = [locations, message.trim()]
        .filter(Boolean)
        .join("\n");
      if (requestMessage.length > 300)
        throw new Error("Lời nhắn và địa điểm không được vượt quá 300 ký tự.");
      return api.call<RidePostResponse>(`/ride-posts/${id}/responses`, "POST", {
        message: requestMessage,
        pickupCheckId: checked?.id,
      });
    },
    onSuccess: () => {
      setMessage("");
      setShowMessage(false);
      void responses.refetch();
      refreshLists();
    },
  });
  const decide = useMutation({
    mutationFn: () =>
      api.call(
        `/ride-post-responses/${decision!.response.id}/decision`,
        "POST",
        { version: decision!.response.version, decision: decision!.value },
      ),
    onSuccess: () => {
      if (decision?.value === "WITHDRAWN") {
        client.setQueryData<RidePostResponse[]>(
          ["mobile-post-responses", id],
          (rows) => rows?.filter((r) => r.id !== decision.response.id),
        );
        setSelectedId(undefined);
        setPreviewPickup(undefined);
        setPreviewDropoff(undefined);
        setPickup(undefined);
        setDropoff(undefined);
        setPickupText("");
        setDropoffText("");
        setCheck(undefined);
        setMessage("");
        setShowMessage(false);
      }
      setDecision(undefined);
      void responses.refetch();
      void post.refetch();
      refreshLists();
    },
  });
  const closePost = useMutation({
    mutationFn: () =>
      api.call<RidePostView>(
        "/ride-posts/" + id + "/close",
        "POST",
        { version: data!.version },
        randomUUID(),
      ),
    onSuccess: () => {
      setClose(false);
      void post.refetch();
      refreshLists();
    },
  });
  const publishDraft = useMutation({
    mutationFn: async () => {
      if (!data || !own || data.status !== "DRAFT")
        throw new Error("Hãy tải lại bản nháp trước khi đăng.");
      const signature = `${id}:${data.version}`;
      if (publication.current?.signature !== signature)
        publication.current = { signature, key: randomUUID() };
      const progress = publication.current;
      if (data.type === "OFFER_RIDE") {
        progress.source ??= await api.call<RidePostDraftSource>(
          `/ride-posts/${encodeURIComponent(id)}/draft-source?version=${data.version}`,
        );
        if (progress.source.status === "DRAFT") {
          await api.call(
            `/trips/${encodeURIComponent(progress.source.id)}/open`,
            "POST",
            { version: progress.source.version },
            progress.key,
          );
          return api.post(id);
        }
      }
      return api.call<RidePostView>(
        `/ride-posts/${encodeURIComponent(id)}/publish`,
        "POST",
        { version: data.version },
        progress.key,
      );
    },
    onSuccess: (updated) => {
      setPublishConfirm(false);
      client.setQueryData(["mobile-post", id], updated);
      refreshLists();
    },
    onError: () => {
      void post.refetch();
      refreshLists();
    },
  });
  const discuss = useMutation({
    mutationFn: () =>
      api.call<JourneyConversation>("/conversations/ride-post", "POST", {
        postId: id,
      }),
    onSuccess: (c) =>
      router.push({ pathname: "/chat/[id]", params: { id: c.id } }),
  });
  return (
    <PostDetailStage
      post={data}
      own={own}
      confirmedResponse={confirmedResponse}
      onMenu={() => setMenuOpen(true)}
      initialSnap={initialSnap}
      expandSignal={sheetExpansion}
      refreshSignal={refreshSignal}
      selected={selected}
      draftPickup={previewPickup}
      draftDropoff={previewDropoff}
      draftCheck={
        viewerPassenger ? (preview.data as PickupCheck | undefined) : undefined
      }
      draftRoute={
        !viewerPassenger
          ? (preview.data as RouteResponse | undefined)
          : undefined
      }
      selectionSignal={selectionSignal}
      onClearSelection={() => setSelectedId(undefined)}
      onDecision={(value) => {
        if (selected) setDecision({ response: selected, value });
      }}
    >
      <ResourceState query={post}>
        {data ? (
          <>
            {own ? (
              <>
                {data.status === "DRAFT" ? (
                  <>
                    <Button
                      label="Đăng bản nháp"
                      disabled={
                        new Date(data.expiresAt).getTime() <= Date.now()
                      }
                      onPress={() => setPublishConfirm(true)}
                    />
                    <Text style={ui.muted}>
                      Kiểm tra lại tuyến, giờ đi và phạm vi hiển thị trước khi
                      đăng. Bản nháp hết hạn cần tạo lại hành trình.
                    </Text>
                  </>
                ) : null}
              </>
            ) : active ? null : (
              <View style={styles.composer} testID="post-request-composer">
                <View style={styles.requestHeader}>
                  <Text style={[styles.connectionHeading, { flex: 1 }]}>
                    {active ? "Đã gửi yêu cầu" : "Yêu cầu ngay"}
                  </Text>
                  <View
                    style={[
                      styles.requestRole,
                      { backgroundColor: requestSoft },
                    ]}
                  >
                    <Icon
                      name={viewerPassenger ? "person-outline" : "car-outline"}
                      size={14}
                      color={requestAccent}
                    />
                    <Text
                      style={[styles.requestRoleText, { color: requestAccent }]}
                    >
                      {viewerPassenger ? "Tôi đi ké" : "Tôi chở"}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Nhắn tin"
                    onPress={() => discuss.mutate()}
                    style={[
                      styles.textAction,
                      { flex: 1, justifyContent: "flex-end" },
                    ]}
                  >
                    <Icon
                      name="chatbubble-ellipses-outline"
                      size={17}
                      color={requestAccent}
                    />
                    <Text
                      style={[styles.textActionLabel, { color: requestAccent }]}
                    >
                      Nhắn tin
                    </Text>
                  </Pressable>
                </View>
                {!active && data.status === "OPEN" ? (
                  <>
                    <View style={styles.placeEntries}>
                      <View style={styles.placeEntry}>
                        <View pointerEvents="none" style={styles.entryRail}>
                          <View style={styles.entryOriginLine} />
                          <View style={styles.entryOriginDot} />
                        </View>
                        <PlacePicker
                          label="Điểm đi"
                          compact
                          accentColor="#dcb84b"
                          dashed
                          hideLeadingIcon
                          containerStyle={{ flex: 1 }}
                          leadingIcon="navigate-circle-outline"
                          onInputChange={(text) => {
                            setPickupText(text);
                            if (!text.trim()) setPreviewPickup(undefined);
                          }}
                          onFocus={() =>
                            setSheetExpansion((value) => value + 1)
                          }
                          value={pickup}
                          disabled={request.isPending}
                          onChange={(place) => {
                            setPickup(place);
                            if (place) {
                              setPickupText(place.displayLabel);
                              setPreviewPickup(place);
                              Keyboard.dismiss();
                              setSelectionSignal((value) => value + 1);
                            }
                            setCheck(undefined);
                          }}
                        />
                      </View>
                      <View style={styles.placeEntry}>
                        <View pointerEvents="none" style={styles.entryRail}>
                          <View style={styles.entryDestinationLine} />
                          <View style={styles.entryDestinationDot} />
                        </View>
                        <PlacePicker
                          label="Điểm đến"
                          compact
                          accentColor={theme.colors.primary}
                          dashed
                          hideLeadingIcon
                          containerStyle={{ flex: 1 }}
                          leadingIcon="flag-outline"
                          onInputChange={(text) => {
                            setDropoffText(text);
                            if (!text.trim()) setPreviewDropoff(undefined);
                          }}
                          onFocus={() =>
                            setSheetExpansion((value) => value + 1)
                          }
                          value={dropoff}
                          disabled={request.isPending}
                          onChange={(place) => {
                            setDropoff(place);
                            if (place) {
                              setDropoffText(place.displayLabel);
                              setPreviewDropoff(place);
                              Keyboard.dismiss();
                              setSelectionSignal((value) => value + 1);
                            }
                            setCheck(undefined);
                          }}
                        />
                      </View>
                    </View>
                    <View style={styles.requestHelpRow}>
                      <Text style={[styles.requestHint, { flex: 1 }]}>
                        Để trống để dùng địa điểm của bài đăng.
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          showMessage ? "Ẩn lời nhắn" : "Thêm lời nhắn"
                        }
                        aria-expanded={showMessage}
                        onPress={() => {
                          if (showMessage) Keyboard.dismiss();
                          setShowMessage((value) => !value);
                        }}
                        style={styles.noteToggle}
                      >
                        <Icon
                          name={showMessage ? "remove" : "add"}
                          size={15}
                          color={requestAccent}
                        />
                        <Text
                          style={[
                            styles.noteToggleText,
                            { color: requestAccent },
                          ]}
                        >
                          {showMessage ? "Ẩn lời nhắn" : "Thêm lời nhắn"}
                        </Text>
                      </Pressable>
                    </View>
                    {check && !check.compatible ? (
                      <Text style={styles.requestHint}>{check.reason}</Text>
                    ) : null}
                    {showMessage ? (
                      <TextInput
                        accessibilityLabel="Lời nhắn"
                        autoFocus
                        onFocus={() => setSheetExpansion((value) => value + 1)}
                        value={message}
                        onChangeText={setMessage}
                        multiline
                        maxLength={300}
                        placeholder="Nhắn gì đó cho chủ bài..."
                        placeholderTextColor={theme.colors.inkMuted}
                        style={[ui.input, styles.messageInput]}
                      />
                    ) : null}
                    <ErrorText error={request.error} />
                    {preview.isFetching ? (
                      <Text style={styles.requestHint}>
                        Đang cập nhật tuyến đi…
                      </Text>
                    ) : null}
                    <ErrorText error={preview.error} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Gửi yêu cầu"
                      disabled={
                        request.isPending ||
                        responses.isPending ||
                        (!!pickupText.trim() && !pickup) ||
                        (!!dropoffText.trim() && !dropoff)
                      }
                      onPress={() => request.mutate()}
                      style={[
                        styles.sendRequest,
                        {
                          backgroundColor: viewerPassenger
                            ? "#f5cf6c"
                            : theme.colors.primary,
                        },
                        (request.isPending ||
                          responses.isPending ||
                          (!!pickupText.trim() && !pickup) ||
                          (!!dropoffText.trim() && !dropoff)) && {
                          opacity: 0.5,
                        },
                      ]}
                    >
                      {request.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Icon
                          name="paper-plane-outline"
                          size={18}
                          color="#fff"
                        />
                      )}
                      <Text style={[styles.sendRequestText, { color: "#fff" }]}>
                        Gửi yêu cầu
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={ui.muted}>
                    {active
                      ? "Theo dõi phản hồi của bạn bên dưới."
                      : "Bài đăng đã ngừng nhận yêu cầu."}
                  </Text>
                )}
                <ErrorText error={discuss.error} />
              </View>
            )}
            {own || !!visibleResponses.length ? (
              <View
                style={[styles.connectionSection, !own && styles.sentSection]}
                testID="post-connections"
              >
                <Pressable
                  testID="requests-background"
                  style={StyleSheet.absoluteFill}
                  accessibilityRole="button"
                  accessibilityLabel="Bỏ chọn yêu cầu"
                  onPress={() => setSelectedId(undefined)}
                />
                {own ? (
                  <View pointerEvents="none" style={styles.connectionHeader}>
                    <View style={styles.connectionTitle}>
                      <Icon name="people-outline" size={18} />
                      <Text style={styles.connectionHeading}>
                        {confirmedResponse
                          ? "Kết nối hành trình"
                          : own
                            ? "Yêu cầu kết nối"
                            : "Yêu cầu của bạn"}
                      </Text>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>
                        {visibleResponses.length}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {!own ? <ErrorText error={discuss.error} /> : null}
                <ResourceState query={responses}>
                  {visibleResponses.length === 0 ? (
                    <Text style={ui.muted}>Chưa có yêu cầu kết nối.</Text>
                  ) : null}
                  {visibleResponses
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(b.id === responseId) -
                        Number(a.id === responseId),
                    )
                    .map((r) => (
                      <PostRequestComment
                        key={r.id}
                        response={r}
                        post={data}
                        own={own}
                        journey={confirmedStatuses.includes(r.status)}
                        onChat={own ? undefined : () => discuss.mutate()}
                        chatPending={discuss.isPending}
                        selected={r.id === selectedId}
                        onSelect={() => {
                          setSelectedId((current) =>
                            current === r.id ? undefined : r.id,
                          );
                          if (selectedId !== r.id)
                            setSelectionSignal((value) => value + 1);
                        }}
                        viewerId={session?.user.id}
                        onDecision={(response, value) =>
                          setDecision({ response, value })
                        }
                      />
                    ))}
                </ResourceState>
              </View>
            ) : null}
          </>
        ) : null}
      </ResourceState>

      <BottomSheet
        visible={menuOpen}
        title="Tùy chọn bài đăng"
        onClose={() => setMenuOpen(false)}
      >
        <Button
          label="Xem hồ sơ người đăng"
          icon="person-outline"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            if (data)
              router.push({
                pathname: "/user/[id]",
                params: { id: data.ownerId },
              });
          }}
        />
        <Button
          label="Làm mới hành trình"
          icon="refresh-outline"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            setRefreshSignal((value) => value + 1);
            void post.refetch();
            void responses.refetch();
            void client.invalidateQueries({
              queryKey: ["mobile-post-route", id],
            });
          }}
        />
        {own && data && ["DRAFT", "OPEN"].includes(data.status) ? (
          <Button
            label="Đóng bài đăng"
            icon="trash-outline"
            variant="danger"
            onPress={() => {
              setMenuOpen(false);
              setClose(true);
            }}
          />
        ) : null}
        {!own ? (
          <Button
            label="Báo cáo bài đăng"
            icon="flag-outline"
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              setReport(true);
            }}
          />
        ) : null}
      </BottomSheet>
      <BottomSheet
        visible={close}
        title="Đóng bài đăng?"
        onClose={() => setClose(false)}
      >
        <Text style={ui.muted}>Bài đăng sẽ ngừng nhận yêu cầu mới.</Text>
        <ErrorText error={closePost.error} />
        <Button
          label="Đóng bài đăng"
          variant="danger"
          pending={closePost.isPending}
          onPress={() => closePost.mutate()}
        />
      </BottomSheet>
      <ReportSheet
        visible={report}
        onClose={() => setReport(false)}
        targetId={id}
        targetType="POST"
      />
      <BottomSheet
        visible={!!decision}
        title="Xác nhận cập nhật"
        onClose={() => setDecision(undefined)}
      >
        <Text style={ui.muted}>
          Chuyển yêu cầu sang trạng thái: {statusLabel(decision?.value || "")}
        </Text>
        <ErrorText error={decide.error} />
        <Button
          label="Xác nhận"
          pending={decide.isPending}
          onPress={() => decide.mutate()}
        />
      </BottomSheet>

      <BottomSheet
        visible={publishConfirm}
        title="Đăng bản nháp này?"
        onClose={() => {
          if (!publishDraft.isPending) setPublishConfirm(false);
        }}
      >
        <Text style={ui.muted}>
          {data?.originLabel} → {data?.destinationLabel}
        </Text>
        <Text style={ui.muted}>
          Giờ đi: {dateTime(data?.departureAt)} · Phạm vi:{" "}
          {data?.visibility === "PUBLIC"
            ? "Công khai"
            : data?.visibility === "FRIENDS"
              ? "Bạn bè"
              : "Cộng đồng"}
        </Text>
        <ErrorText error={publishDraft.error} />
        <Button
          label="Xác nhận đăng bản nháp"
          pending={publishDraft.isPending}
          onPress={() => publishDraft.mutate()}
        />
      </BottomSheet>
    </PostDetailStage>
  );
}

const styles = StyleSheet.create({
  composer: {
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    gap: 8,
  },
  requestHelpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  messageInput: {
    minHeight: 48,
    maxHeight: 80,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    textAlignVertical: "top",
  },
  noteToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 28,
    flexShrink: 0,
  },
  noteToggleText: { fontSize: 11, fontWeight: "600" },
  placeEntries: { gap: 12 },
  placeEntry: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  entryRail: { width: 14, alignItems: "center", justifyContent: "center" },
  entryOriginLine: {
    position: "absolute",
    width: 2,
    top: "50%",
    bottom: -6,
    backgroundColor: "#dcb84b",
  },
  entryDestinationLine: {
    position: "absolute",
    width: 2,
    top: -6,
    bottom: "50%",
    backgroundColor: theme.colors.primary,
  },
  entryOriginDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#dcb84b",
    backgroundColor: "#fff",
  },
  entryDestinationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  requestRole: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requestRoleText: { fontSize: 10, fontWeight: "700" },
  sendRequest: {
    minHeight: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendRequestText: { fontSize: 13, fontWeight: "700" },
  requestHint: { fontSize: 10, lineHeight: 15, color: theme.colors.inkMuted },
  textAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
  },
  textActionLabel: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  sentSection: { paddingHorizontal: 0, paddingVertical: 0, borderTopWidth: 0 },
  connectionSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#e9eeeb",
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectionTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  connectionHeading: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f7f1",
  },
  countText: { color: theme.colors.primary, fontSize: 12, fontWeight: "700" },
  responseCard: {
    borderRadius: 14,
    backgroundColor: "#f4f6f5",
    padding: 10,
    gap: 8,
  },
});
