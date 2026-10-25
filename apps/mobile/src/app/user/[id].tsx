import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type {
  JourneyConversation,
  JourneyReview,
  RelationView,
} from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { ReportSheet } from "@/components/ReportSheet";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function UserProfile() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const api = useMobileApi();
  const { session } = useSession();
  const [report, setReport] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const query = useQuery({
    queryKey: ["mobile-user", id],
    queryFn: () => api.userProfile(id),
  });
  const relation = useQuery({
    queryKey: ["mobile-relation", id],
    queryFn: () => api.call<RelationView>(`/friendships/users/${id}`),
    enabled: id !== session?.user.id,
  });
  const reviews = useQuery({
    queryKey: ["mobile-user-reviews", id],
    queryFn: () =>
      api.call<JourneyReview[]>(`/users/${id}/reviews?role=DRIVER`),
  });
  const ratings = useQuery({
    queryKey: ["mobile-user-ratings", id],
    queryFn: () =>
      api.call<{ role: string; average: number | null; reviewCount: number }[]>(
        `/users/${id}/ratings`,
      ),
  });
  const chat = useMutation({
    mutationFn: () =>
      api.call<JourneyConversation>("/conversations/direct", "POST", {
        recipientUserId: id,
      }),
    onSuccess: (c) =>
      router.push({ pathname: "/chat/[id]", params: { id: c.id } }),
  });
  const block = useMutation({
    mutationFn: () =>
      api.call(
        `/blocks/${id}`,
        relation.data?.blockedByMe ? "DELETE" : "PUT",
        undefined,
        randomUUID(),
      ),
    onSuccess: () => {
      setBlocking(false);
      void relation.refetch();
    },
  });
  return (
    <DetailPage
      title="Người cùng đường"
      subtitle="Hiểu nhau hơn trước mỗi hành trình"
      onRefresh={() => {
        void query.refetch();
        void reviews.refetch();
        void ratings.refetch();
      }}
      refreshing={query.isRefetching}
    >
      <ResourceState query={query}>
        {query.data ? (
          <ProfileIdentity
            name={query.data.displayName}
            avatar={query.data.avatarUrl}
          >
            {query.data.verified ? <Badge label="Đã xác minh" /> : null}
            <Text style={[ui.muted, { textAlign: "center" }]}>
              {query.data.bio || "Thành viên cộng đồng Dike"}
            </Text>
          </ProfileIdentity>
        ) : null}
      </ResourceState>
      <ResourceState query={ratings}>
        {ratings.data?.map((r) => (
          <Card key={r.role}>
            <Text style={ui.sectionTitle}>
              {r.role === "DRIVER" ? "Người chở" : "Người đi ké"}
            </Text>
            <Text style={ui.muted}>
              {r.reviewCount
                ? `${r.average?.toFixed(1)} / 5 · ${r.reviewCount} đánh giá`
                : "Chưa có đánh giá"}
            </Text>
          </Card>
        ))}
      </ResourceState>
      {id !== session?.user.id ? (
        <>
          <ErrorText error={chat.error} />
          <Button
            label="Nhắn tin"
            icon="chatbubble-outline"
            pending={chat.isPending}
            disabled={relation.data?.blockedByMe}
            onPress={() => chat.mutate()}
          />
          <Button
            label={
              relation.data?.blockedByMe
                ? "Bỏ chặn người dùng"
                : "Chặn người dùng"
            }
            variant="secondary"
            onPress={() => setBlocking(true)}
          />
          <Button
            label="Báo cáo người dùng"
            variant="secondary"
            onPress={() => setReport(true)}
          />
        </>
      ) : null}
      <Text style={ui.sectionTitle}>Đánh giá công khai</Text>
      <ResourceState query={reviews}>
        {reviews.data?.length === 0 ? (
          <EmptyState title="Chưa có đánh giá công khai" />
        ) : (
          reviews.data?.map((r) => (
            <Card key={r.id}>
              <Text style={{ fontSize: 15, fontWeight: "700" }}>
                {r.reviewerDisplayName} · {r.stars}/5
              </Text>
              <Text style={ui.muted}>
                {r.comment || "Không có lời nhận xét."}
              </Text>
            </Card>
          ))
        )}
      </ResourceState>
      <BottomSheet
        visible={blocking}
        title={
          relation.data?.blockedByMe
            ? "Bỏ chặn thành viên?"
            : "Chặn thành viên?"
        }
        onClose={() => setBlocking(false)}
      >
        <Text style={ui.muted}>
          Trạng thái chặn ảnh hưởng đến việc liên hệ và kết nối trên Dike.
        </Text>
        <ErrorText error={block.error} />
        <Button
          label="Xác nhận"
          pending={block.isPending}
          onPress={() => block.mutate()}
        />
      </BottomSheet>
      <ReportSheet
        visible={report}
        onClose={() => setReport(false)}
        targetId={id}
        targetType="USER"
      />
    </DetailPage>
  );
}
