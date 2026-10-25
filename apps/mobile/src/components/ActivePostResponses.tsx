import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { RidePostResponse } from "@dike/api-client-ts";
import { useMobileApi } from "@/core/hooks";
import { ResourceState } from "./ResourceState";
import { PostResponseCard } from "./PostResponseCard";
import { Button, Text, ui } from "./ui";

export function ActivePostResponses({
  compact = false,
}: {
  compact?: boolean;
}) {
  const api = useMobileApi();
  const [focused, setFocused] = useState(true);
  const query = useQuery({
    queryKey: ["mobile-active-responses"],
    queryFn: () => api.call<RidePostResponse[]>("/ride-post-responses/active"),
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
  const rows = query.data ?? [];
  if (compact && query.isSuccess && !rows.length) return null;
  return (
    <>
      <Text style={ui.sectionTitle}>Tiếp tục hành trình đi cùng</Text>
      <ResourceState query={query}>
        {(compact ? rows.slice(0, 1) : rows).map((r) => (
          <PostResponseCard key={r.id} response={r} />
        ))}
        {!rows.length ? (
          <Text style={ui.muted}>Chưa có yêu cầu đi cùng đã được đồng ý.</Text>
        ) : null}
        {compact && rows.length > 1 ? (
          <Button
            label={`Xem ${rows.length} hành trình đi cùng`}
            variant="secondary"
            onPress={() => router.push("/(tabs)/trips")}
          />
        ) : null}
      </ResourceState>
    </>
  );
}
