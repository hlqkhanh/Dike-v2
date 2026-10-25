import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { RidePostInboxPage } from "@dike/api-client-ts";
import { View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import { PostResponseCard } from "@/components/PostResponseCard";
import { Button, Card, Chip, Text, ui } from "@/components/ui";
import { useMobileApi } from "@/core/hooks";

export default function Requests() {
  const api = useMobileApi();
  const [direction, setDirection] = useState("received");
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(true);
  const query = useInfiniteQuery({
    queryKey: ["mobile-response-inbox", direction],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.call<RidePostInboxPage>(
        `/ride-post-responses?direction=${direction}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (p) => p.nextCursor || undefined,
    enabled: focused,
    refetchInterval: focused ? 15000 : false,
  });
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void query.refetch();
      return () => setFocused(false);
    }, [query.refetch]),
  );
  const rows =
    query.data?.pages
      .flatMap((p) => p.items)
      .filter((r) => !pending || r.status === "PENDING") ?? [];
  return (
    <DetailPage
      title="Yêu cầu đi cùng"
      subtitle="Nhận được, đã gửi và các phản hồi trước đây"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={ui.wrap}>
        {[
          ["received", "Nhận được"],
          ["sent", "Đã gửi"],
        ].map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            selected={direction === v}
            onPress={() => setDirection(v)}
          />
        ))}
      </View>
      <View style={ui.wrap}>
        <Chip
          label="Tất cả trạng thái"
          selected={!pending}
          onPress={() => setPending(false)}
        />
        <Chip
          label="Chờ phản hồi"
          selected={pending}
          onPress={() => setPending(true)}
        />
      </View>
      <ResourceState query={query}>
        {rows.map((r) => (
          <PostResponseCard key={r.id} response={r} />
        ))}
        {!rows.length ? (
          <Card>
            <Text style={ui.sectionTitle}>Chưa có yêu cầu trong nhóm này</Text>
            <Text style={ui.muted}>
              {query.hasNextPage
                ? "Còn yêu cầu chưa tải. Tải thêm để xem các yêu cầu cũ hơn."
                : "Yêu cầu gửi từ bài đăng và phản hồi của bạn sẽ được lưu ở đây."}
            </Text>
          </Card>
        ) : null}
      </ResourceState>
      {query.hasNextPage ? (
        <Button
          label="Tải thêm yêu cầu"
          variant="secondary"
          pending={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      ) : null}
    </DetailPage>
  );
}
