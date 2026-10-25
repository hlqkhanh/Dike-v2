import { useQuery } from "@tanstack/react-query";
import {} from "react-native";
import { Text } from "@/components/ui";

import { Screen, sharedStyles } from "./Screen";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";

type Props = {
  queryKey: string;
  title: string;
  subtitle: string;
  load: (
    api: ReturnType<typeof createMobileApi>,
  ) => Promise<unknown[] | { items: unknown[] }>;
};

export function ApiListScreen({ queryKey, title, subtitle, load }: Props) {
  const { token } = useSession();
  const query = useQuery({
    queryKey: [queryKey],
    queryFn: () => load(createMobileApi(() => Promise.resolve(token))),
  });
  const items = Array.isArray(query.data)
    ? query.data
    : (query.data?.items ?? []);
  return (
    <Screen
      loading={query.isLoading}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle={subtitle}
      title={title}
    >
      {query.error ? (
        <Text accessibilityRole="alert" style={sharedStyles.empty}>
          Không tải được dữ liệu. Kéo xuống để thử lại.
        </Text>
      ) : null}
      {!query.error && items.length === 0 ? (
        <Text style={sharedStyles.empty}>Chưa có dữ liệu phù hợp.</Text>
      ) : null}
      {items.map((item, index) => (
        <Text
          key={String((item as { id?: string }).id ?? index)}
          style={sharedStyles.card}
        >
          {JSON.stringify(item, null, 2)}
        </Text>
      ))}
    </Screen>
  );
}
