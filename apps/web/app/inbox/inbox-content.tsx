"use client";
import { useSearchParams } from "next/navigation";
import { MemberAvatar } from "../components/member-avatar";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, ChevronRight, MessageCircle, Search } from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";
import { ConversationContent } from "./conversation-content";

type Filter = "ALL" | "UNREAD" | "BOOKING" | "DIRECT";
const filters: Array<[Filter, string]> = [
  ["ALL", "Tất cả"],
  ["UNREAD", "Chưa đọc"],
  ["BOOKING", "Chuyến đi"],
  ["DIRECT", "Trực tiếp"],
];

export function InboxContent() {
  const params = useSearchParams();
  const conversationId = params.get("conversation");
  const postId = params.get("post");
  return (
    <InboxWorkspace
      key={conversationId ?? "inbox"}
      initialConversationId={conversationId}
      initialPostId={postId}
    />
  );
}

function InboxWorkspace({
  initialConversationId,
  initialPostId,
}: {
  initialConversationId: string | null;
  initialPostId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversationId,
  );
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => {
      const container = workspace.current;
      if (!container) return;
      const height = window.visualViewport?.height ?? window.innerHeight;
      container.style.setProperty(
        "--inbox-height",
        `${Math.max(0, height - container.getBoundingClientRect().top - 16)}px`,
      );
    };
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: journeyApi.conversations,
    refetchInterval: 15000,
  });
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...(conversations.data ?? [])]
      .filter(
        (item) =>
          filter === "ALL" ||
          (filter === "UNREAD" ? item.unreadCount > 0 : item.type === filter),
      )
      .filter(
        (item) =>
          !needle ||
          `${item.recipientDisplayName ?? ""} ${item.id} ${item.bookingId ?? ""} ${item.type === "BOOKING" ? "Hội thoại chuyến đi" : "Hội thoại trực tiếp"}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) =>
        (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
      );
  }, [conversations.data, filter, search]);
  return (
    <div
      ref={workspace}
      className={`inbox-workspace inbox-layout inbox-split${selectedId ? " has-selection" : ""}`}
    >
      <div className="inbox-sidebar">
        <section className="inbox-list" aria-label="Danh sách hội thoại">
          <div className="inbox-list-toolbar">
            <div className="inbox-list-heading">
              <div>
                <h2>
                  Hội thoại gần đây
                  {conversations.data ? (
                    <span className="inbox-total">
                      {conversations.data.length}
                    </span>
                  ) : null}
                </h2>
                <p>Giữ liên lạc với những người đồng hành.</p>
              </div>
              <label className="inbox-search">
                <Search aria-hidden="true" size={17} />
                <span className="sr-only">Tìm hội thoại</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm hội thoại…"
                  type="search"
                />
              </label>
            </div>
            <div
              className="inbox-filters"
              role="group"
              aria-label="Lọc hội thoại"
            >
              {filters.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  {value === "UNREAD" &&
                  conversations.data?.some((item) => item.unreadCount > 0) ? (
                    <span className="inbox-filter-dot" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div
            className="inbox-results"
            aria-live="polite"
            aria-busy={conversations.isPending}
          >
            {conversations.isPending ? (
              <LoadingState />
            ) : conversations.isError ? (
              <ErrorState
                message={conversations.error.message}
                onRetry={() => void conversations.refetch()}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={
                  conversations.data.length
                    ? "Không có hội thoại phù hợp"
                    : "Chưa có cuộc trò chuyện"
                }
                description={
                  conversations.data.length
                    ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
                    : "Khi bạn kết nối với một chuyến đi hoặc nhắn cho thành viên, hội thoại sẽ xuất hiện tại đây."
                }
              />
            ) : (
              visible.map((conversation) => (
                <button
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  aria-pressed={selectedId === conversation.id}
                  className={`inbox-conversation${conversation.unreadCount ? " is-unread" : ""}`}
                  key={conversation.id}
                >
                  {conversation.recipientDisplayName ? (
                    <MemberAvatar
                      name={conversation.recipientDisplayName}
                      avatarUrl={conversation.recipientAvatarUrl}
                      className="inbox-avatar"
                      size={48}
                    />
                  ) : (
                    <span
                      className={`inbox-avatar${conversation.type === "BOOKING" ? " is-trip" : ""}`}
                      aria-hidden="true"
                    >
                      {conversation.type === "BOOKING" ? (
                        <CarFront size={23} />
                      ) : (
                        <MessageCircle size={23} />
                      )}
                    </span>
                  )}
                  <div className="conversation-card-copy">
                    <h3>
                      {conversation.recipientDisplayName ||
                        (conversation.type === "BOOKING"
                          ? "Hội thoại chuyến đi"
                          : "Hội thoại trực tiếp")}
                    </h3>
                    <p>
                      {conversation.type === "BOOKING"
                        ? "Trao đổi chi tiết hành trình"
                        : "Tin nhắn giữa hai thành viên"}
                    </p>
                  </div>
                  <div className="conversation-card-meta">
                    {conversation.lastMessageAt ? (
                      <time dateTime={conversation.lastMessageAt}>
                        {new Date(
                          conversation.lastMessageAt,
                        ).toLocaleDateString("vi-VN")}
                      </time>
                    ) : null}
                    {conversation.state !== "OPEN" ? (
                      <small>
                        {conversation.state === "READ_ONLY"
                          ? "Chỉ đọc"
                          : conversation.state === "REQUEST_PENDING"
                            ? "Chờ chấp nhận"
                            : conversation.state === "CLOSED"
                              ? "Đã đóng"
                              : "Hạn chế nhắn tin"}
                      </small>
                    ) : null}
                    {conversation.unreadCount ? (
                      <strong
                        aria-label={`${conversation.unreadCount} tin chưa đọc`}
                      >
                        {conversation.unreadCount > 99
                          ? "99+"
                          : conversation.unreadCount}
                      </strong>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="inbox-row-arrow"
                    aria-hidden="true"
                    size={18}
                  />
                </button>
              ))
            )}
          </div>
          <p className="inbox-sync-note">
            <span aria-hidden="true" />
            Hội thoại được cập nhật tự động
          </p>
        </section>
      </div>
      <section className="inbox-detail" aria-label="Chi tiết hội thoại">
        {selectedId ? (
          <>
            <button
              type="button"
              className="inbox-back"
              onClick={() => setSelectedId(null)}
            >
              ← Danh sách hội thoại
            </button>
            <ConversationContent
              key={selectedId}
              id={selectedId}
              embedded
              initialPostId={
                selectedId === initialConversationId ? initialPostId : null
              }
            />
          </>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title="Chọn một hội thoại"
            description="Chọn một hội thoại trong danh sách để xem và gửi tin nhắn."
          />
        )}
      </section>
    </div>
  );
}
