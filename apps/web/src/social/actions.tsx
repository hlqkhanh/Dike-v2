"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { RelationView } from "@dike/api-client-ts";
import { socialApi } from "./api";
import { broadcastSocialChange, clearSocialContent } from "./invalidation";

const labels: Record<string, string> = {
  SEND: "Kết bạn",
  ACCEPT: "Chấp nhận",
  DECLINE: "Từ chối",
  CANCEL: "Rút lời mời",
  REMOVE: "Hủy kết bạn",
  BLOCK: "Chặn",
  UNBLOCK: "Bỏ chặn",
};
export function RelationActions({ relation }: { relation: RelationView }) {
  const client = useQueryClient();
  const pendingKey = useRef<{ action: string; key: string } | null>(null);
  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (pendingKey.current?.action !== action)
        pendingKey.current = { action, key: crypto.randomUUID() };
      return socialApi.act(
        action,
        relation.userId,
        relation.requestId,
        pendingKey.current.key,
      );
    },
    onSuccess: async () => {
      pendingKey.current = null;
      broadcastSocialChange();
      await clearSocialContent(client);
    },
  });
  function act(action: string) {
    if (
      action === "BLOCK" &&
      !window.confirm(
        "Chặn sẽ kết thúc quan hệ và ẩn nội dung hai phía. Liên hệ phục vụ booking đang hoạt động vẫn được giữ. Tiếp tục?",
      )
    )
      return;
    if (
      action === "REMOVE" &&
      !window.confirm(
        "Hủy kết bạn sẽ thu hồi nội dung dành cho bạn bè. Cần chờ 7 ngày trước khi gửi lại. Tiếp tục?",
      )
    )
      return;
    mutation.mutate(action);
  }
  return (
    <div className="social-actions">
      {relation.allowedActions.map((action) => (
        <button
          type="button"
          key={action}
          disabled={mutation.isPending}
          onClick={() => act(action)}
        >
          {labels[action] ?? action}
        </button>
      ))}
      {relation.cooldownUntil && !relation.allowedActions.includes("SEND") ? (
        <p>
          Có thể gửi lại từ{" "}
          {new Date(relation.cooldownUntil).toLocaleString("vi-VN")}
        </p>
      ) : null}
      {relation.blockedByMe ? <p>Bỏ chặn không tự khôi phục bạn bè.</p> : null}
      {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
    </div>
  );
}

export function ProfileSocialActions({ userId }: { userId: string }) {
  const relation = useQuery({
    queryKey: ["social", "relation", userId],
    queryFn: () => socialApi.relation(userId),
    retry: false,
  });
  if (!relation.data || relation.isError) return null;
  return <RelationActions relation={relation.data} />;
}
