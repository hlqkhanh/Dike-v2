"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { journeyApi } from "../../src/journey/api";

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
    <main className="settings-page">
      <h1>Tin nhắn</h1>
      <section className="settings-card">
        <h2>Bắt đầu hội thoại</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label>
            ID thành viên
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              required
            />
          </label>
          <button disabled={create.isPending || !recipient.trim()}>
            Tiếp tục
          </button>
        </form>
        {create.isError ? <p role="alert">{create.error.message}</p> : null}
      </section>
      {conversations.isPending ? (
        <p>Đang tải…</p>
      ) : conversations.isError ? (
        <p role="alert">{conversations.error.message}</p>
      ) : (
        conversations.data.map((conversation) => (
          <article className="settings-card" key={conversation.id}>
            <h2>
              <Link href={`/inbox/${encodeURIComponent(conversation.id)}`}>
                {conversation.type === "BOOKING"
                  ? "Hội thoại chuyến đi"
                  : "Hội thoại trực tiếp"}
              </Link>
            </h2>
            <p>
              {conversation.state} · {conversation.unreadCount} tin chưa đọc
            </p>
          </article>
        ))
      )}
    </main>
  );
}
