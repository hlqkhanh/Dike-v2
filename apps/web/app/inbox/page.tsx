"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, Plus, Search, Users } from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

type Filter = "ALL" | "UNREAD" | "BOOKING" | "DIRECT";
const filters: Array<[Filter, string]> = [
  ["ALL", "Tất cả"],
  ["UNREAD", "Chưa đọc"],
  ["BOOKING", "Chuyến đi"],
  ["DIRECT", "Trực tiếp"],
];

export default function InboxPage() {
  const client = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: journeyApi.conversations,
    refetchInterval: 15000,
  });
  const create = useMutation({
    mutationFn: () => journeyApi.direct(recipient.trim()),
    onSuccess: async () => {
      setRecipient("");
      await client.invalidateQueries({ queryKey: ["conversations"] });
    },
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
          `${item.id} ${item.bookingId ?? ""} ${item.state}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) =>
        (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
      );
  }, [conversations.data, filter, search]);
  return (
    <main className="settings-page inbox-page">
      <PageHeader
        eyebrow="Kết nối an toàn"
        title="Tin nhắn"
        description="Trao đổi điểm đón, thời gian và chi tiết chuyến đi với người đồng hành."
      />
      <div className="inbox-layout">
        <section className="settings-card inbox-start-card">
          <span className="inbox-card-icon">
            <Plus aria-hidden="true" size={20} />
          </span>
          <div>
            <h2>Bắt đầu hội thoại</h2>
            <p>Nhập ID của thành viên bạn muốn nhắn tin.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label className="inbox-recipient-field">
              <span className="sr-only">ID thành viên</span>
              <Users aria-hidden="true" size={18} />
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                required
                placeholder="ID thành viên"
              />
            </label>
            <button
              className="app-button app-button--primary"
              disabled={create.isPending || !recipient.trim()}
            >
              Tiếp tục <ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>
          {create.isError ? (
            <p className="auth-error" role="alert">
              {create.error.message}
            </p>
          ) : null}
        </section>
        <section className="inbox-list" aria-label="Danh sách hội thoại">
          <div className="inbox-list-heading">
            <div>
              <h2>Hội thoại gần đây</h2>
              <p>Cập nhật tự động mỗi 15 giây</p>
            </div>
            <label className="inbox-search">
              <Search aria-hidden="true" size={17} />
              <span className="sr-only">Tìm hội thoại</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo mã"
              />
            </label>
          </div>
          <div className="app-filter-tabs" aria-label="Lọc hội thoại">
            {filters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
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
              <article
                className={`settings-card conversation-card${conversation.unreadCount ? " is-unread" : ""}`}
                key={conversation.id}
              >
                <span className="app-avatar" aria-hidden="true">
                  {conversation.type === "BOOKING" ? "CX" : "TN"}
                </span>
                <div className="conversation-card-copy">
                  <h3>
                    <Link
                      href={`/inbox/${encodeURIComponent(conversation.id)}`}
                    >
                      {conversation.type === "BOOKING"
                        ? "Hội thoại chuyến đi"
                        : "Hội thoại trực tiếp"}
                    </Link>
                  </h3>
                  <p>
                    {conversation.type === "BOOKING"
                      ? "Trao đổi chi tiết hành trình"
                      : "Tin nhắn giữa hai thành viên"}
                  </p>
                </div>
                <div className="conversation-card-meta">
                  <small>{conversation.state}</small>
                  {conversation.lastMessageAt ? (
                    <time dateTime={conversation.lastMessageAt}>
                      {new Date(conversation.lastMessageAt).toLocaleDateString(
                        "vi-VN",
                      )}
                    </time>
                  ) : null}
                  {conversation.unreadCount ? (
                    <strong
                      aria-label={`${conversation.unreadCount} tin chưa đọc`}
                    >
                      {conversation.unreadCount}
                    </strong>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
