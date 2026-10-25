import type { RidePostResponse, RidePostInboxItem } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMobileApi, dateTime, statusLabel } from "@/core/hooks";
import { useSession } from "@/core/session";
import { Button, Card, RouteCard, Text, ui } from "./ui";

export function PostResponseCard({
  response: r,
}: {
  response: RidePostResponse | RidePostInboxItem;
}) {
  const api = useMobileApi();
  const { session } = useSession();
  const post = useQuery({
    queryKey: ["mobile-post", r.postId],
    queryFn: () => api.post(r.postId),
    retry: false,
  });
  const received = r.ownerId === session?.user.id;
  const awaiting = r.status === "PENDING";
  return (
    <Card>
      <Text style={ui.eyebrow}>
        {received ? "Yêu cầu nhận được" : "Yêu cầu đã gửi"} ·{" "}
        {statusLabel(r.status)}
      </Text>
      <Text style={ui.sectionTitle}>
        {received
          ? r.requesterDisplayName
          : post.data?.ownerDisplayName || "Người đăng bài"}
      </Text>
      {post.data ? (
        <RouteCard
          origin={post.data.originLabel}
          destination={post.data.destinationLabel}
        />
      ) : (
        <Text style={ui.muted}>
          {post.isError
            ? "Bài đăng hiện không truy cập được. Hãy tải lại danh sách."
            : "Đang tải hành trình…"}
        </Text>
      )}
      <Text style={ui.muted}>
        {awaiting
          ? received
            ? "Đang chờ bạn phản hồi"
            : "Đang chờ người đăng phản hồi"
          : statusLabel(r.status)}{" "}
        · {dateTime(r.updatedAt)}
      </Text>
      {r.message ? <Text style={ui.muted}>{r.message}</Text> : null}
      <Button
        label={awaiting && received ? "Xem và phản hồi" : "Xem tiến độ yêu cầu"}
        variant="secondary"
        disabled={post.isError}
        onPress={() =>
          router.push({
            pathname: "/posts/[id]",
            params: { id: r.postId, responseId: r.id },
          })
        }
      />
    </Card>
  );
}
