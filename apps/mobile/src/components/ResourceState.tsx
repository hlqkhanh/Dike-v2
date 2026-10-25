import type { PropsWithChildren } from "react";
import { EmptyState, LoadingCards } from "./ui";
export function ResourceState({
  query,
  children,
}: PropsWithChildren<{
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}>) {
  if (query.isLoading) return <LoadingCards />;
  if (query.isError)
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Chưa thể tải dữ liệu"
        description={
          query.error instanceof Error
            ? query.error.message
            : "Kiểm tra kết nối mạng và thử lại."
        }
        onRetry={() => void query.refetch()}
      />
    );
  return children;
}
