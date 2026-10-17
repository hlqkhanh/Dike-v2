"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  MapPin,
  Pin,
  Route,
  Send,
  X,
} from "lucide-react";
import { authApi } from "../../src/auth/api";
import { journeyApi } from "../../src/journey/api";
import { rideApi } from "../../src/rides/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";
import { MemberAvatar } from "../components/member-avatar";
import {
  isActiveResponse,
  ResponseProgress,
} from "../../src/rides/response-progress";

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
  initialPostId = null,
}: {
  id: string;
  embedded?: boolean;
  initialPostId?: string | null;
}) {
  const client = useQueryClient();
  const thread = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [attachmentDraft, setAttachmentDraft] = useState({
    sourceId: initialPostId,
    postId: initialPostId,
  });
  if (attachmentDraft.sourceId !== initialPostId) {
    setAttachmentDraft({ sourceId: initialPostId, postId: initialPostId });
  }
  const draftPostId = attachmentDraft.postId;
  const draftPost = useQuery({
    queryKey: ["feed", "detail", draftPostId],
    queryFn: () => rideApi.post(draftPostId!),
    enabled: Boolean(draftPostId),
    retry: false,
  });
  const clearAttachment = () => {
    setAttachmentDraft({ sourceId: initialPostId, postId: null });
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState(null, "", url);
  };
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
  const listedConversation = conversations.data?.find((item) => item.id === id);
  const info = useQuery({
    queryKey: ["conversation-info", id],
    queryFn: () => journeyApi.conversationInfo(id),
    enabled: conversations.isSuccess && !listedConversation,
  });
  const conversation = listedConversation ?? info.data;
  const pinnedPostId = conversation?.postId;
  const pinnedPost = useQuery({
    queryKey: ["feed", "detail", pinnedPostId],
    queryFn: () => rideApi.post(pinnedPostId!),
    enabled: Boolean(pinnedPostId),
    retry: false,
  });
  const pinnedResponses = useQuery({
    queryKey: ["feed", "responses", pinnedPostId],
    queryFn: () => rideApi.postResponses(pinnedPostId!),
    enabled: Boolean(pinnedPostId),
    refetchInterval: pinnedPostId ? 15_000 : false,
    retry: false,
  });
  const pinnedResponse = pinnedResponses.data?.find(
    (item) => item.conversationId === id && isActiveResponse(item),
  );
  const recipientId = conversation?.participantIds?.find(
    (participantId) => participantId !== session.data?.user.id,
  );
  const recipientName =
    conversation?.recipientDisplayName ||
    (conversation?.type === "DIRECT"
      ? "Hội thoại trực tiếp"
      : "Hội thoại chuyến đi");
  const canSend = conversation?.canSend ?? conversation?.state === "OPEN";
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
    mutationFn: () =>
      journeyApi.sendMessage(
        id,
        text.trim(),
        crypto.randomUUID(),
        draftPostId ?? undefined,
      ),
    onSuccess: async () => {
      setText("");
      if (draftPostId) clearAttachment();
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
        eyebrow={
          conversation?.state === "REQUEST_PENDING"
            ? "Lời mời nhắn tin"
            : conversation?.state === "OPEN"
              ? "Đang trò chuyện"
              : "Hội thoại"
        }
        title={
          recipientId ? (
            <Link
              className="conversation-profile-link"
              href={`/profile/${encodeURIComponent(recipientId)}`}
              aria-label={`Xem hồ sơ của ${recipientName}`}
            >
              <MemberAvatar
                name={recipientName}
                avatarUrl={conversation?.recipientAvatarUrl}
                className="conversation-header-avatar"
                size={44}
              />
              <span>{recipientName}</span>
            </Link>
          ) : (
            recipientName
          )
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
      {pinnedPost.data ? (
        <Link
          className="conversation-pinned-trip"
          href={`/feed/${encodeURIComponent(pinnedPost.data.id)}`}
          aria-label={`Xem chi tiết chuyến đi từ ${pinnedPost.data.originLabel} đến ${pinnedPost.data.destinationLabel}`}
        >
          <header>
            <span>
              <Pin aria-hidden="true" size={19} /> Chuyến đi đã ghim
            </span>
          </header>
          <div className="conversation-pinned-trip-body">
            <div className="conversation-pinned-route">
              <MapPin aria-hidden="true" size={19} />
              <strong>{pinnedPost.data.originLabel}</strong>
              <span
                className="conversation-pinned-route-arrow"
                aria-hidden="true"
              >
                <ArrowRight size={17} />
              </span>
              <strong>{pinnedPost.data.destinationLabel}</strong>
            </div>
            <div className="conversation-pinned-time">
              <CalendarDays aria-hidden="true" size={19} />
              <span>
                <strong>
                  {new Date(pinnedPost.data.departureAt).toLocaleDateString(
                    "vi-VN",
                    {
                      timeZone: messageTimeZone,
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    },
                  )}
                </strong>
                <small>
                  {clockFormatter.format(new Date(pinnedPost.data.departureAt))}
                </small>
              </span>
            </div>
            {pinnedResponse && session.data?.user.id ? (
              <ResponseProgress
                compact
                response={pinnedResponse}
                currentUserId={session.data.user.id}
                onUpdated={() => void pinnedResponses.refetch()}
              />
            ) : null}
          </div>
        </Link>
      ) : null}
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
                    {own ? (
                      <MemberAvatar
                        name={session.data?.user.displayName || "Bạn"}
                        avatarUrl={session.data?.user.avatarUrl}
                        className="message-user-avatar"
                        size={36}
                      />
                    ) : recipientId ? (
                      <Link
                        className="message-avatar-link"
                        href={`/profile/${encodeURIComponent(recipientId)}`}
                        aria-label={`Xem hồ sơ của ${recipientName}`}
                      >
                        <MemberAvatar
                          name={recipientName}
                          avatarUrl={conversation?.recipientAvatarUrl}
                          className="message-user-avatar"
                          size={36}
                        />
                      </Link>
                    ) : (
                      <MemberAvatar
                        name={recipientName}
                        avatarUrl={conversation?.recipientAvatarUrl}
                        className="message-user-avatar"
                        size={36}
                      />
                    )}
                    <div
                      className="message-bubble"
                      tabIndex={0}
                      aria-describedby={`message-time-${message.id}`}
                    >
                      {!continued ? (
                        <strong>{own ? "Bạn" : recipientName}</strong>
                      ) : null}
                      {message.hidden || message.text ? (
                        <p className={message.hidden ? "is-hidden" : undefined}>
                          {message.hidden ? "Tin nhắn đã bị ẩn" : message.text}
                        </p>
                      ) : null}
                      {!message.hidden && message.ridePost ? (
                        <Link
                          className="message-ride-card"
                          href={`/feed/${encodeURIComponent(message.ridePost.postId)}`}
                        >
                          <span className="message-ride-kind">
                            <CarFront aria-hidden="true" size={16} />
                            {message.ridePost.type === "OFFER_RIDE"
                              ? "Chuyến đi chia sẻ"
                              : "Tìm bạn đồng hành"}
                          </span>
                          <strong>{message.ridePost.originLabel}</strong>
                          <span className="message-ride-destination">
                            <ArrowRight aria-hidden="true" size={14} />
                            {message.ridePost.destinationLabel}
                          </span>
                          <span className="message-ride-meta">
                            {new Date(
                              message.ridePost.departureAt,
                            ).toLocaleDateString("vi-VN", {
                              timeZone: messageTimeZone,
                              day: "2-digit",
                              month: "2-digit",
                            })}
                            {" · "}
                            {clockFormatter.format(
                              new Date(message.ridePost.departureAt),
                            )}
                            {" · "}
                            {message.ridePost.vehicleType === "MOTORCYCLE"
                              ? "Xe máy"
                              : "Ô tô"}
                          </span>
                          <span className="message-ride-open">
                            Xem chuyến đi{" "}
                            <ArrowRight aria-hidden="true" size={14} />
                          </span>
                        </Link>
                      ) : null}
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
          if (
            send.isPending ||
            (!text.trim() && !draftPostId) ||
            !canSend ||
            (draftPostId && !draftPost.data)
          )
            return;
          send.mutate();
        }}
      >
        {draftPostId ? (
          <div
            className="message-attachment-draft"
            aria-label="Bài đăng đính kèm chưa gửi"
          >
            <div className="message-attachment-heading">
              <span>
                <CarFront aria-hidden="true" size={17} /> Bài đăng đính kèm
              </span>
              <button
                type="button"
                aria-label="Bỏ đính kèm bài đăng"
                disabled={send.isPending}
                onClick={clearAttachment}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            {draftPost.isError ? (
              <p role="alert">{draftPost.error.message}</p>
            ) : draftPost.data ? (
              <Link href={`/feed/${encodeURIComponent(draftPostId)}`}>
                <strong>{draftPost.data.originLabel}</strong>
                <ArrowRight aria-hidden="true" size={14} />
                <strong>{draftPost.data.destinationLabel}</strong>
                <small>
                  {new Date(draftPost.data.departureAt).toLocaleDateString(
                    "vi-VN",
                    {
                      timeZone: messageTimeZone,
                      day: "2-digit",
                      month: "2-digit",
                    },
                  )}
                  {" · "}
                  {clockFormatter.format(new Date(draftPost.data.departureAt))}
                </small>
              </Link>
            ) : (
              <span>Đang tải bài đăng…</span>
            )}
          </div>
        ) : null}
        <label className="message-input">
          <span className="sr-only">Tin nhắn</span>
          <textarea
            ref={input}
            aria-label="Tin nhắn"
            disabled={!canSend}
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
            send.isPending ||
            (!text.trim() && !draftPostId) ||
            !canSend ||
            Boolean(draftPostId && !draftPost.data)
          }
        >
          <Send aria-hidden="true" size={18} />
        </button>
        {conversation && !canSend ? (
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
