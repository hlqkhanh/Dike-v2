"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, MessageCircle, Plus, Search, Users } from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

export default function InboxPage() {
  const client = useQueryClient();
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: journeyApi.conversations,
    refetchInterval: 15000,
  });
  const [recipient, setRecipient] = useState("");
  const create = useMutation({
    mutationFn: () => journeyApi.direct(recipient.trim()),
    onSuccess: async () => {
      setRecipient("");
      await client.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
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
          {create.isError ? <p role="alert">{create.error.message}</p> : null}
        </section>
        <section className="inbox-list" aria-label="Danh sách hội thoại">
          <div className="inbox-list-heading">
            <div>
              <h2>Hội thoại gần đây</h2>
              <p>Cập nhật tự động mỗi 15 giây</p>
            </div>
            <button
              className="app-icon-button"
              type="button"
              aria-label="Tìm hội thoại"
            >
              <Search aria-hidden="true" size={18} />
            </button>
          </div>
          {conversations.isPending ? (
            <LoadingState />
          ) : conversations.isError ? (
            <ErrorState
              message={conversations.error.message}
              onRetry={() => void conversations.refetch()}
            />
          ) : conversations.data.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Chưa có cuộc trò chuyện"
              description="Khi bạn kết nối với một chuyến đi hoặc nhắn cho thành viên, hội thoại sẽ xuất hiện tại đây."
            />
          ) : (
            conversations.data.map((conversation) => (
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
