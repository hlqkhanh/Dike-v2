"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { Route, Send } from "lucide-react";
import { authApi } from "../../src/auth/api";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

const messageTimeZone = "Asia/Ho_Chi_Minh";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: messageTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const clockFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: messageTimeZone,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function localDay(date: Date) {
  const parts = dayFormatter.formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}

function timeLabel(date: Date, detailed = false) {
  const now = new Date();
  const day = dayFormatter.format(date);
  const time = detailed
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: messageTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date)
    : clockFormatter.format(date);
  if (!detailed && day === dayFormatter.format(now)) return time;
  const today = localDay(now);
  const weekStart = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
  const messageDay = localDay(date);
  if (messageDay >= weekStart && messageDay < weekStart + 7 * 86400000) {
    const weekday = new Intl.DateTimeFormat("vi-VN", {
      timeZone: messageTimeZone,
      weekday: "long",
    }).format(date);
    return `${weekday}, ${time}`;
  }
  const yearFormatter = new Intl.DateTimeFormat("en", {
    timeZone: messageTimeZone,
    year: "numeric",
  });
  const dateLabel = new Intl.DateTimeFormat("vi-VN", {
    timeZone: messageTimeZone,
    day: "2-digit",
    month: "2-digit",
    ...(detailed || yearFormatter.format(date) !== yearFormatter.format(now)
      ? { year: "numeric" as const }
      : {}),
  }).format(date);
  return `${dateLabel}, ${time}`;
}

export function ConversationContent({
  id,
  embedded = false,
}: {
  id: string;
  embedded?: boolean;
}) {
  const client = useQueryClient();
  const thread = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    const textarea = input.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 144)}px`;
  }, [text]);
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
  useEffect(() => {
    const container = thread.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.data?.length]);
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
    <div
      className={
        embedded
          ? "conversation-content is-embedded"
          : "settings-page conversation-page"
      }
    >
      <PageHeader
        backHref={embedded ? undefined : "/friends"}
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
        ref={thread}
        className="settings-card message-thread message-thread--grouped"
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
            .map((message, index, sorted) => {
              const own = message.senderId === session.data?.user.id;
              const previous = sorted[index - 1];
              const date = new Date(message.createdAt);
              const previousDate = previous
                ? new Date(previous.createdAt)
                : null;
              const gap = previousDate
                ? date.getTime() - previousDate.getTime()
                : 0;
              const showTime =
                !previousDate ||
                gap >= 30 * 60 * 1000 ||
                dayFormatter.format(previousDate) !== dayFormatter.format(date);
              const spaced = !showTime && gap >= 5 * 60 * 1000;
              const continued =
                !!previous &&
                previous.senderId === message.senderId &&
                !showTime &&
                !spaced;
              return (
                <Fragment key={message.id}>
                  {showTime ? (
                    <time
                      className="message-time-divider"
                      dateTime={message.createdAt}
                    >
                      {timeLabel(date)}
                    </time>
                  ) : null}
                  <article
                    className={`message-row${own ? " is-own" : ""}${continued ? " is-continuation" : ""}${spaced ? " has-time-gap" : ""}${previous && !continued && !showTime && !spaced ? " is-new-sender" : ""}`}
                  >
                    <span
                      className="app-avatar app-avatar--small"
                      aria-hidden="true"
                    >
                      {own ? "BẠ" : message.senderId.slice(0, 2).toUpperCase()}
                    </span>
                    <div
                      className="message-bubble"
                      tabIndex={0}
                      aria-describedby={`message-time-${message.id}`}
                    >
                      {!continued ? (
                        <strong>{own ? "Bạn" : message.senderId}</strong>
                      ) : null}
                      <p className={message.hidden ? "is-hidden" : undefined}>
                        {message.hidden ? "Tin nhắn đã bị ẩn" : message.text}
                      </p>
                      <span
                        id={`message-time-${message.id}`}
                        className="message-time-tooltip"
                        role="tooltip"
                      >
                        {timeLabel(date, true)}
                      </span>
                    </div>
                  </article>
                </Fragment>
              );
            })
        )}
      </section>
      <form
        className="settings-card message-composer message-composer--compact"
        onSubmit={(event) => {
          event.preventDefault();
          if (send.isPending || !text.trim() || conversation?.state !== "OPEN")
            return;
          send.mutate();
        }}
      >
        <label className="message-input">
          <span className="sr-only">Tin nhắn</span>
          <textarea
            ref={input}
            aria-label="Tin nhắn"
            disabled={conversation?.state !== "OPEN"}
            readOnly={send.isPending}
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return;
              event.preventDefault();
              if (!event.repeat) event.currentTarget.form?.requestSubmit();
            }}
            placeholder="Nhập tin nhắn…"
            rows={1}
          />
          {text.length >= 1800 ? (
            <small className="message-character-count">
              {text.length}/2000
            </small>
          ) : null}
        </label>
        <button
          className="app-button app-button--primary message-send"
          aria-label={send.isPending ? "Đang gửi…" : "Gửi"}
          title={send.isPending ? "Đang gửi…" : "Gửi tin nhắn (Enter)"}
          type="submit"
          disabled={
            send.isPending || !text.trim() || conversation?.state !== "OPEN"
          }
        >
          <Send aria-hidden="true" size={18} />
        </button>
        {conversation && conversation.state !== "OPEN" ? (
          <p className="message-status" role="status">
            Hội thoại này hiện không cho phép gửi tin nhắn.
          </p>
        ) : null}
        {send.isError ? (
          <p className="auth-error" role="alert">
            {send.error.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
