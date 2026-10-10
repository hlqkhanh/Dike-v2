"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import { Route, Send } from "lucide-react";
import { authApi } from "../../../src/auth/api";
import { journeyApi } from "../../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/app-ui";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const client = useQueryClient();
  const [text, setText] = useState("");
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: journeyApi.conversations,
  });
  const conversation = conversations.data?.find((item) => item.id === id);
  const messages = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => journeyApi.messages(id),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const latest = messages.data?.reduce(
      (current, item) => (item.sequence > current.sequence ? item : current),
      messages.data[0],
    );
    if (latest)
      void journeyApi
        .read(id, latest.sequence)
        .then(() => client.invalidateQueries({ queryKey: ["conversations"] }));
  }, [client, id, messages.data]);
  const send = useMutation({
    mutationFn: () => journeyApi.sendMessage(id, text.trim()),
    onSuccess: async () => {
      setText("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["conversation", id] }),
        client.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
    },
  });
  return (
    <main className="settings-page conversation-page">
      <PageHeader
        backHref="/inbox"
        backLabel="Tất cả tin nhắn"
        eyebrow={conversation?.state ?? "Đang hoạt động"}
        title={
          conversation?.type === "DIRECT"
            ? "Hội thoại trực tiếp"
            : "Hội thoại chuyến đi"
        }
        description="Chỉ chia sẻ thông tin cần thiết cho hành trình và không gửi dữ liệu nhạy cảm."
        actions={
          conversation?.bookingId ? (
            <Link
              className="app-button app-button--secondary"
              href={`/bookings/${encodeURIComponent(conversation.bookingId)}`}
            >
              <Route aria-hidden="true" size={17} /> Xem đặt chỗ
            </Link>
          ) : undefined
        }
      />
      <section
        className="settings-card message-thread"
        aria-live="polite"
        aria-label="Nội dung hội thoại"
      >
        {messages.isPending ? (
          <LoadingState label="Đang tải tin nhắn" />
        ) : messages.isError ? (
          <ErrorState
            message={messages.error.message}
            onRetry={() => void messages.refetch()}
          />
        ) : messages.data.length === 0 ? (
          <EmptyState
            title="Bắt đầu cuộc trò chuyện"
            description="Gửi lời chào và thống nhất điểm đón với người đồng hành."
          />
        ) : (
          [...messages.data]
            .sort((a, b) => a.sequence - b.sequence)
            .map((message) => {
              const own = message.senderId === session.data?.user.id;
              return (
                <article
                  className={`message-row${own ? " is-own" : ""}`}
                  key={message.id}
                >
                  <span
                    className="app-avatar app-avatar--small"
                    aria-hidden="true"
                  >
                    {own ? "BẠ" : message.senderId.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="message-bubble">
                    <strong>{own ? "Bạn" : message.senderId}</strong>
                    <p className={message.hidden ? "is-hidden" : undefined}>
                      {message.hidden ? "Tin nhắn đã bị ẩn" : message.text}
                    </p>
                    <small>
                      {new Date(message.createdAt).toLocaleString("vi-VN")}
                    </small>
                  </div>
                </article>
              );
            })
        )}
      </section>
      <form
        className="settings-card message-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <label className="message-input">
          <span className="sr-only">Tin nhắn</span>
          <textarea
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nhập tin nhắn…"
            rows={2}
          />
          <small>{text.length}/2000</small>
        </label>
        <button
          className="app-button app-button--primary message-send"
          disabled={send.isPending || !text.trim()}
        >
          <Send aria-hidden="true" size={18} />
          <span>{send.isPending ? "Đang gửi…" : "Gửi"}</span>
        </button>
        {send.isError ? (
          <p className="auth-error" role="alert">
            {send.error.message}
          </p>
        ) : null}
      </form>
    </main>
  );
}
