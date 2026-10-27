import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type {
  JourneyConversation,
  PickupCheck,
  PlaceResponse,
  RidePostResponse,
  RidePostRoute,
  RidePostView,
  RidePostDraftSource,
} from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { PlacePicker } from "@/components/PlacePicker";
import { ReportSheet } from "@/components/ReportSheet";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  ErrorText,
  Field,
  Icon,
  RouteCard,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime, money, statusLabel } from "@/core/hooks";
import { useSession } from "@/core/session";
import { RouteMapSurface } from "@/components/RouteMapSurface";
import { theme } from "@/core/theme";
export default function PostDetail() {
  const { id = "", responseId } = useLocalSearchParams<{
    id: string;
    responseId?: string;
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
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(false);
  const [message, setMessage] = useState("");
  const [pickup, setPickup] = useState<PlaceResponse>();
  const [dropoff, setDropoff] = useState<PlaceResponse>();
  const [check, setCheck] = useState<PickupCheck>();
  const [decision, setDecision] = useState<{
    response: RidePostResponse;
    value: string;
  }>();
  const [close, setClose] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const post = useQuery({
    queryKey: ["mobile-post", id],
    queryFn: () => api.post(id),
  });
  const responses = useQuery({
    queryKey: ["mobile-post-responses", id],
    queryFn: () => api.postResponses(id),
    refetchInterval: 10000,
  });
  const route = useQuery({
    queryKey: ["mobile-post-route", id],
    queryFn: () => api.call<RidePostRoute>(`/ride-posts/${id}/route`),
  });
  const data = post.data;
  const own = data?.ownerId === session?.user.id;
  const active = responses.data?.some(
    (r) =>
      r.requesterId === session?.user.id &&
      !["REJECTED", "WITHDRAWN"].includes(r.status),
  );
  const validate = useMutation({
    mutationFn: async () => {
      setCheck(undefined);
      setCheck(
        await api.call<PickupCheck>(`/ride-posts/${id}/pickup-checks`, "POST", {
          pickupPlaceRef: pickup?.placeRef,
          dropoffPlaceRef: dropoff?.placeRef,
          useDriverPickup: !pickup,
          useDriverDropoff: !dropoff,
        }),
      );
    },
  });
  const request = useMutation({
    mutationFn: () =>
      api.call<RidePostResponse>(`/ride-posts/${id}/responses`, "POST", {
        message: message.trim(),
        pickupCheckId: check?.id,
      }),
    onSuccess: () => {
      setOpen(false);
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
      setDecision(undefined);
      void responses.refetch();
      void post.refetch();
      refreshLists();
    },
  });
  const closePost = useMutation({
    mutationFn: () =>
      api.call<RidePostView>(
        `/ride-posts/${id}/close`,
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
    <DetailPage
      title="Chi tiết hành trình"
      backgroundColor="#ffffff"
      onRefresh={() => {
        void post.refetch();
        setMapFailed(false);
        void responses.refetch();
      }}
      refreshing={post.isRefetching}
    >
      <ResourceState query={post}>
        {data ? (
          <>
            <Card style={styles.profileCard}>
              <View style={styles.ownerRow}>
                <Avatar
                  name={data.ownerDisplayName}
                  uri={data.ownerAvatarUrl}
                  size={44}
                />
                <View style={styles.ownerIdentity}>
                  <Text style={styles.ownerName}>{data.ownerDisplayName}</Text>
                  <Text style={styles.ownerRole}>
                    {data.type === "NEED_RIDE" ? "Cần đi ké" : "Có chỗ trống"}
                  </Text>
                  <Badge label={statusLabel(data.status)} />
                </View>
                <Pressable
                  accessibilityLabel="Xem hồ sơ người đăng"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/user/[id]",
                      params: { id: data.ownerId },
                    })
                  }
                  style={styles.profileLink}
                >
                  <Icon name="person-outline" size={18} />
                  <Text style={styles.profileLinkText}>Xem hồ sơ</Text>
                  <Icon name="chevron-forward" size={17} />
                </Pressable>
              </View>
            </Card>
            <View
              style={styles.map}
              accessibilityLabel="Bản đồ tuyến đường thực tế"
            >
              {route.isPending ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : mapFailed || !route.data?.geometry?.length ? (
                <View style={styles.mapFallback}>
                  <Icon
                    name="map-outline"
                    size={24}
                    color={theme.colors.inkMuted}
                  />
                  <Text style={ui.muted}>Chưa tải được bản đồ</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMapFailed(false);
                      setMapAttempt((value) => value + 1);
                      void route.refetch();
                    }}
                    style={styles.retryMap}
                  >
                    <Text style={styles.profileLinkText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : (
                <RouteMapSurface
                  key={mapAttempt}
                  geometry={route.data.geometry}
                  onError={() => setMapFailed(true)}
                />
              )}
            </View>
            <Card>
              <RouteCard
                origin={data.originLabel}
                destination={data.destinationLabel}
              />
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Icon name="calendar-outline" size={18} />
                  <View style={styles.metaCopy}>
                    <Text style={styles.metaValue}>
                      {dateTime(data.departureAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaItem}>
                  <Icon
                    name={
                      data.vehicleType === "CAR"
                        ? "car-outline"
                        : "bicycle-outline"
                    }
                    size={18}
                  />
                  <View style={styles.metaCopy}>
                    <Text style={styles.metaValue}>
                      {data.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="navigate-outline" size={18} />
                  <View style={styles.metaCopy}>
                    <Text style={styles.metaValue}>
                      {route.data
                        ? `${(route.data.distanceMeters / 1000).toFixed(1)} km · ${Math.ceil(route.data.durationSeconds / 60)} phút`
                        : "Đang tải..."}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="people-outline" size={18} />
                  <View style={styles.metaCopy}>
                    <Text style={styles.metaValue}>
                      {data.remainingSeats} chỗ ·{" "}
                      {money(data.contributionPerKm)}/km
                    </Text>
                  </View>
                </View>
              </View>
              {data.note ? <Text style={styles.note}>{data.note}</Text> : null}
            </Card>
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
                <Button
                  label="Đóng bài đăng"
                  variant="secondary"
                  disabled={!["DRAFT", "OPEN"].includes(data.status)}
                  onPress={() => setClose(true)}
                />
              </>
            ) : (
              <>
                <View style={styles.actionRow}>
                  <View style={styles.actionCell}>
                    <Button
                      label={
                        active
                          ? "Đã gửi"
                          : data.type === "NEED_RIDE"
                            ? "Đề nghị chở"
                            : "Đi ké"
                      }
                      icon={
                        data.type === "NEED_RIDE"
                          ? "car-outline"
                          : "people-outline"
                      }
                      disabled={active || data.status !== "OPEN"}
                      onPress={() => setOpen(true)}
                    />
                  </View>
                  <View style={styles.actionCell}>
                    <Button
                      label="Nhắn tin"
                      icon="chatbubble-ellipses-outline"
                      variant="secondary"
                      pending={discuss.isPending}
                      onPress={() => discuss.mutate()}
                    />
                  </View>
                </View>
                <ErrorText error={discuss.error} />
              </>
            )}
            <Text style={ui.sectionTitle}>
              {own ? "Yêu cầu kết nối" : "Yêu cầu của bạn"}
            </Text>
            <ResourceState query={responses}>
              {responses.data?.length === 0 ? (
                <Text style={ui.muted}>Chưa có yêu cầu kết nối.</Text>
              ) : null}
              {responses.data
                ?.slice()
                .sort(
                  (a, b) =>
                    Number(b.id === responseId) - Number(a.id === responseId),
                )
                .map((r) => {
                  const driver =
                    r.action === "REQUEST_RIDE" ? r.ownerId : r.requesterId;
                  const next = (
                    {
                      ACCEPTED: "DRIVER_STARTED",
                      DRIVER_STARTED: "DRIVER_ARRIVED",
                      DRIVER_ARRIVED: "COMPLETED",
                    } as Record<string, string>
                  )[r.status];
                  return (
                    <Card key={r.id}>
                      <View style={ui.row}>
                        <Avatar
                          name={r.requesterDisplayName}
                          uri={r.requesterAvatarUrl}
                        />
                        <Text
                          style={[ui.sectionTitle, { flex: 1, fontSize: 16 }]}
                        >
                          {r.requesterDisplayName}
                        </Text>
                      </View>
                      <Badge label={statusLabel(r.status)} />
                      {r.message ? (
                        <Text style={ui.muted}>{r.message}</Text>
                      ) : null}
                      {r.pickupCheck ? (
                        <Text style={ui.muted}>
                          Đón lúc {dateTime(r.pickupCheck.pickupAt)} ·{" "}
                          {r.pickupCheck.pickup.displayLabel}
                        </Text>
                      ) : null}
                      {r.status === "PENDING" ? (
                        own ? (
                          <>
                            <Button
                              label="Chấp nhận"
                              onPress={() =>
                                setDecision({ response: r, value: "ACCEPTED" })
                              }
                            />
                            <Button
                              label="Từ chối"
                              variant="secondary"
                              onPress={() =>
                                setDecision({ response: r, value: "REJECTED" })
                              }
                            />
                          </>
                        ) : (
                          <Button
                            label="Rút yêu cầu"
                            variant="secondary"
                            onPress={() =>
                              setDecision({ response: r, value: "WITHDRAWN" })
                            }
                          />
                        )
                      ) : null}
                      {driver === session?.user.id && next ? (
                        <Button
                          label={statusLabel(next)}
                          onPress={() =>
                            setDecision({ response: r, value: next })
                          }
                        />
                      ) : null}
                      {r.conversationId ? (
                        <Button
                          label="Mở trò chuyện"
                          variant="secondary"
                          onPress={() =>
                            router.push({
                              pathname: "/chat/[id]",
                              params: { id: r.conversationId! },
                            })
                          }
                        />
                      ) : null}
                    </Card>
                  );
                })}
            </ResourceState>
            {!own ? (
              <Button
                label="Báo cáo bài đăng"
                variant="secondary"
                onPress={() => setReport(true)}
              />
            ) : null}
          </>
        ) : null}
      </ResourceState>
      <BottomSheet
        visible={open}
        title="Kết nối hành trình"
        onClose={() => {
          if (!request.isPending) setOpen(false);
        }}
      >
        {data?.type === "OFFER_RIDE" ? (
          <>
            <Text style={ui.muted}>
              Mặc định đi cùng toàn tuyến của tài xế. Bạn có thể chọn điểm đón
              và xuống khác, rồi kiểm tra độ phù hợp.
            </Text>
            <PlacePicker
              label="Điểm đón khác (tùy chọn)"
              disabled={validate.isPending || request.isPending}
              value={pickup}
              onChange={(p) => {
                setPickup(p);
                setCheck(undefined);
              }}
            />
            <PlacePicker
              label="Điểm xuống khác (tùy chọn)"
              disabled={validate.isPending || request.isPending}
              value={dropoff}
              onChange={(p) => {
                setDropoff(p);
                setCheck(undefined);
              }}
            />
            <Button
              label="Kiểm tra điểm đón"
              variant="secondary"
              pending={validate.isPending}
              onPress={() => validate.mutate()}
            />
            {check ? (
              <Text style={ui.muted}>
                {check.compatible
                  ? `Phù hợp · Đón ${dateTime(check.pickupAt)}`
                  : `Chưa phù hợp: ${check.reason}`}
              </Text>
            ) : null}
            <ErrorText error={validate.error} />
          </>
        ) : null}
        <Field
          label="Lời nhắn"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={300}
        />
        <ErrorText error={request.error} />
        <Button
          label="Gửi yêu cầu"
          pending={request.isPending}
          disabled={
            data?.type === "OFFER_RIDE" &&
            (!check?.compatible || Date.parse(check.expiresAt) <= Date.now())
          }
          onPress={() => request.mutate()}
        />
      </BottomSheet>
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
    </DetailPage>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1, minWidth: 0 },
  actionRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  map: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    height: 180,
    justifyContent: "center",
    overflow: "hidden",
    width: "100%",
  },
  mapFallback: {
    alignItems: "center",
    gap: theme.spacing.xs,
    justifyContent: "center",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  metaItem: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    gap: theme.spacing.xs,
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    width: "48%",
  },
  metaCopy: { flex: 1, minWidth: 0 },
  metaValue: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  note: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    color: theme.colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    paddingTop: theme.spacing.md,
  },
  ownerIdentity: { flex: 1, gap: 2, minWidth: 0 },
  ownerName: { color: theme.colors.ink, fontSize: 16, fontWeight: "800" },
  ownerRole: { color: theme.colors.inkMuted, fontSize: 12 },
  ownerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  profileCard: { padding: theme.spacing.md },
  profileLink: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: 2,
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
  },
  profileLinkText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  retryMap: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
