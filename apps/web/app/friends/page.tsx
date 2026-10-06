"use client";

import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { socialApi } from "../../src/social/api";
import {
  ProfileSocialActions,
  RelationActions,
} from "../../src/social/actions";
import { useAuthFailure } from "../../src/auth/use-auth-failure";

const tabs = {
  friends: "Bạn bè",
  incoming: "Lời mời đến",
  outgoing: "Đã gửi",
  blocks: "Đã chặn",
} as const;
export default function FriendsPage() {
  const [tab, setTab] = useState<keyof typeof tabs>("friends");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const list = useInfiniteQuery({
    queryKey: ["social", "list", tab],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => socialApi.list(tab, pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const results = useQuery({
    queryKey: ["social", "search", search],
    queryFn: () => socialApi.search(search),
    enabled: search.length >= 2,
  });
  useAuthFailure(list.error);
  const items = [
    ...new Map(
      (list.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [
        item.userId,
        item,
      ]),
    ).values(),
  ];
  return (
    <main className="settings-page">
      <h1>Bạn bè</h1>
      <p>Quản lý lời mời và người bạn muốn chia sẻ hành trình.</p>
      <form
        className="social-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(text.trim());
        }}
      >
        <label htmlFor="social-search">Tìm theo tên</label>
        <input
          id="social-search"
          value={text}
          minLength={2}
          maxLength={80}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" disabled={text.trim().length < 2}>
          Tìm người
        </button>
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setText("");
            }}
          >
            Đóng tìm kiếm
          </button>
        ) : null}
      </form>
      {search ? (
        <section aria-label="Kết quả tìm kiếm">
          {results.isPending ? (
            <p>Đang tìm…</p>
          ) : results.isError ? (
            <p role="alert">{results.error.message}</p>
          ) : results.data.items.length === 0 ? (
            <p>Không tìm thấy người phù hợp.</p>
          ) : (
            results.data.items.map((user) => (
              <article className="settings-card" key={user.userId}>
                <Link href={`/users/${encodeURIComponent(user.userId)}`}>
                  {user.displayName}
                </Link>
                <ProfileSocialActions userId={user.userId} />
              </article>
            ))
          )}
        </section>
      ) : null}
      <nav className="social-tabs" aria-label="Quan hệ">
        {Object.entries(tabs).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key as keyof typeof tabs)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section aria-label={tabs[tab]} aria-live="polite">
        {list.isPending ? (
          <p>Đang tải…</p>
        ) : list.isError ? (
          <p role="alert">
            {list.error.message}{" "}
            <button onClick={() => void list.refetch()}>Thử lại</button>
          </p>
        ) : items.length === 0 ? (
          <p>Chưa có mục nào trong {tabs[tab].toLowerCase()}.</p>
        ) : (
          items.map((item) => (
            <article className="settings-card" key={item.userId}>
              {item.blockedByMe ? (
                <p>
                  {item.displayName} · {item.userId}
                </p>
              ) : (
                <Link href={`/users/${encodeURIComponent(item.userId)}`}>
                  {item.displayName}
                </Link>
              )}
              <RelationActions relation={item} />
            </article>
          ))
        )}
        {list.hasNextPage ? (
          <button
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Xem thêm
          </button>
        ) : null}
      </section>
    </main>
  );
}
