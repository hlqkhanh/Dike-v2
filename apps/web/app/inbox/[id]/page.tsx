"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import {
  ImagePlus,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
} from "lucide-react";
import { journeyApi } from "../../../src/journey/api";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const client = useQueryClient();
  const [text, setText] = useState("");
  const messages = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => journeyApi.messages(id),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const latest = messages.data?.[0];
    if (latest) void journeyApi.read(id, latest.sequence);
  }, [id, messages.data]);
  const send = useMutation({
    mutationFn: () => journeyApi.sendMessage(id, text),
    onSuccess: async () => {
      setText("");
      await client.invalidateQueries({ queryKey: ["conversation", id] });
    },
  });
  return (
    <main className="settings-page conversation-page">
      <PageHeader
        backHref="/inbox"
        backLabel="Tất cả tin nhắn"
        eyebrow="Đang hoạt động"
        title="Hội thoại chuyến đi"
        description="Chỉ chia sẻ thông tin cần thiết cho hành trình và không gửi dữ liệu nhạy cảm."
        actions={
          <button
            className="app-icon-button"
            type="button"
            aria-label="Tùy chọn hội thoại"
          >
            <MoreHorizontal aria-hidden="true" size={20} />
          </button>
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
          <div className="message-thread-empty">
            <span className="app-avatar" aria-hidden="true">
              DK
            </span>
            <h2>Bắt đầu cuộc trò chuyện</h2>
            <p>Gửi lời chào và thống nhất điểm đón với người đồng hành.</p>
          </div>
        ) : (
          [...messages.data].reverse().map((message) => (
            <article className="message-row" key={message.id}>
              <span className="app-avatar app-avatar--small" aria-hidden="true">
                {message.senderId.slice(0, 2).toUpperCase()}
              </span>
              <div className="message-bubble">
                <strong>{message.senderId}</strong>
                <p className={message.hidden ? "is-hidden" : undefined}>
                  {message.hidden ? "Tin nhắn đã bị ẩn" : message.text}
                </p>
                <small>
                  {new Date(message.createdAt).toLocaleString("vi-VN")}
                </small>
              </div>
            </article>
          ))
        )}
      </section>
      <form
        className="settings-card message-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <div className="message-tools" aria-label="Đính kèm">
          <button
            className="app-icon-button"
            type="button"
            aria-label="Đính kèm tệp"
          >
            <Paperclip aria-hidden="true" size={19} />
          </button>
          <button
            className="app-icon-button"
            type="button"
            aria-label="Đính kèm ảnh"
          >
            <ImagePlus aria-hidden="true" size={19} />
          </button>
        </div>
        <label className="message-input">
          <span className="sr-only">Tin nhắn</span>
          <textarea
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Nhập tin nhắn…"
            rows={2}
          />
        </label>
        <button
          className="app-icon-button"
          type="button"
          aria-label="Chọn biểu tượng cảm xúc"
        >
          <Smile aria-hidden="true" size={19} />
        </button>
        <button
          className="app-button app-button--primary message-send"
          disabled={send.isPending || !text.trim()}
        >
          <Send aria-hidden="true" size={18} /> <span>Gửi</span>
        </button>
        {send.isError ? <p role="alert">{send.error.message}</p> : null}
      </form>
    </main>
  );
}
