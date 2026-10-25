import { useState } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { RidePostPage } from "@dike/api-client-ts";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { Button, Card, Chip, RouteCard, Text, ui } from "@/components/ui";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";

export default function MyPosts() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [tab, setTab] = useState(filter === "drafts" ? "DRAFT" : "ALL");
  const api = useMobileApi();
  const query = useInfiniteQuery({
    queryKey: ["mobile-my-posts"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.call<RidePostPage>(
        `/ride-posts?tab=mine${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (page) => page.nextCursor || undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const posts =
    query.data?.pages
      .flatMap((p) => p.items)
      .filter((p) => tab === "ALL" || p.status === tab) ?? [];
  return (
    <DetailPage
      title="Bài của tôi"
      subtitle="Mở lại bản nháp, đăng hoặc quản lý yêu cầu"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={ui.wrap}>
        {[
          ["ALL", "Tất cả"],
          ["DRAFT", "Bản nháp"],
          ["OPEN", "Đang mở"],
          ["CLOSED", "Đã đóng"],
        ].map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            selected={tab === v}
            onPress={() => setTab(v)}
          />
        ))}
      </View>
      <ResourceState query={query}>
        {!posts.length ? (
          <Card>
            <Text style={ui.sectionTitle}>Chưa có bài trong nhóm này</Text>
            <Text style={ui.muted}>
              {query.hasNextPage
                ? "Còn bài chưa tải. Tải thêm để kiểm tra các bài cũ hơn."
                : "Bài bạn đăng hoặc lưu nháp sẽ xuất hiện tại đây."}
            </Text>
          </Card>
        ) : null}
        {posts.map((p) => (
          <Card key={p.id}>
            <Text style={ui.sectionTitle}>
              {p.type === "OFFER_RIDE" ? "Tôi chở" : "Tôi đi ké"} ·{" "}
              {statusLabel(p.status)}
            </Text>
            <RouteCard
              origin={p.originLabel}
              destination={p.destinationLabel}
            />
            <Text style={ui.muted}>
              {dateTime(p.departureAt)} · {p.pendingResponseCount} yêu cầu chờ
            </Text>
            <Button
              label={
                p.status === "DRAFT" ? "Xem lại bản nháp" : "Quản lý bài đăng"
              }
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/posts/[id]", params: { id: p.id } })
              }
            />
          </Card>
        ))}
      </ResourceState>
      {query.hasNextPage ? (
        <Button
          label="Tải thêm bài của tôi"
          variant="secondary"
          pending={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}
    </DetailPage>
  );
}
