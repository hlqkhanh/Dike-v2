"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import { journeyApi } from "../../../src/journey/api";

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
    <main className="settings-page">
      <h1>Hội thoại</h1>
      <section className="settings-card" aria-live="polite">
        {messages.isPending ? (
          <p>Đang tải…</p>
        ) : messages.isError ? (
          <p role="alert">{messages.error.message}</p>
        ) : (
          [...messages.data].reverse().map((message) => (
            <article key={message.id}>
              <strong>{message.senderId}</strong>
              <p>{message.hidden ? "Tin nhắn đã bị ẩn" : message.text}</p>
              <small>
                {new Date(message.createdAt).toLocaleString("vi-VN")}
              </small>
            </article>
          ))
        )}
      </section>
      <form
        className="settings-card"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <label>
          Tin nhắn
          <textarea
            maxLength={2000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button disabled={send.isPending || !text.trim()}>Gửi</button>
        {send.isError ? <p role="alert">{send.error.message}</p> : null}
      </form>
    </main>
  );
}
