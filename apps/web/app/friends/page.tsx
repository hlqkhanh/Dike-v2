"use client";

import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserPlus, Users, X } from "lucide-react";
import { socialApi } from "../../src/social/api";
import {
  ProfileSocialActions,
  RelationActions,
} from "../../src/social/actions";
import { useAuthFailure } from "../../src/auth/use-auth-failure";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

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
    <main className="settings-page friends-page">
      <PageHeader
        eyebrow="Mạng lưới tin cậy"
        title="Bạn bè"
        description="Kết nối với những người bạn tin tưởng để chia sẻ hành trình nhanh hơn và an tâm hơn."
      />
      <form
        className="social-search app-panel"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(text.trim());
        }}
      >
        <label htmlFor="social-search">Tìm thành viên theo tên</label>
        <div className="social-search-control">
          <Search aria-hidden="true" size={19} />
          <input
            id="social-search"
            value={text}
            minLength={2}
            maxLength={80}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ví dụ: Minh Anh"
          />
        </div>
        <button
          className="app-button app-button--primary"
          type="submit"
          disabled={text.trim().length < 2}
        >
          <Search aria-hidden="true" size={17} />
          Tìm người
        </button>
        {search ? (
          <button
            className="app-button app-button--secondary"
            type="button"
            onClick={() => {
              setSearch("");
              setText("");
            }}
          >
            <X aria-hidden="true" size={17} /> Đóng
          </button>
        ) : null}
      </form>
      {search ? (
        <section aria-label="Kết quả tìm kiếm">
          {results.isPending ? (
            <LoadingState label="Đang tìm thành viên" />
          ) : results.isError ? (
            <ErrorState message={results.error.message} />
          ) : results.data.items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Không tìm thấy thành viên"
              description="Hãy kiểm tra lại tên hoặc thử một từ khóa ngắn hơn."
            />
          ) : (
            results.data.items.map((user) => (
              <article className="settings-card person-card" key={user.userId}>
                <span className="app-avatar" aria-hidden="true">
                  {user.displayName.slice(0, 2).toUpperCase()}
                </span>
                <div className="person-card-copy">
                  <Link href={`/users/${encodeURIComponent(user.userId)}`}>
                    {user.displayName}
                  </Link>
                  <small>Thành viên Diké</small>
                </div>
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
          <LoadingState />
        ) : list.isError ? (
          <ErrorState
            message={list.error.message}
            onRetry={() => void list.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === "friends" ? Users : UserPlus}
            title={`Chưa có ${tabs[tab].toLowerCase()}`}
            description={
              tab === "friends"
                ? "Tìm người bạn quen biết để xây dựng mạng lưới đi chung đáng tin cậy."
                : "Các lời mời và thay đổi quan hệ sẽ được hiển thị tại đây."
            }
            action={
              tab === "friends" ? (
                <button
                  className="app-button app-button--primary"
                  type="button"
                  onClick={() =>
                    document.getElementById("social-search")?.focus()
                  }
                >
                  <Search aria-hidden="true" size={17} /> Tìm bạn bè
                </button>
              ) : undefined
            }
          />
        ) : (
          items.map((item) => (
            <article className="settings-card person-card" key={item.userId}>
              <span className="app-avatar" aria-hidden="true">
                {item.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div className="person-card-copy">
                {item.blockedByMe ? (
                  <p>{item.displayName}</p>
                ) : (
                  <Link href={`/users/${encodeURIComponent(item.userId)}`}>
                    {item.displayName}
                  </Link>
                )}
                <small>{item.blockedByMe ? "Đã chặn" : "Bạn đồng hành"}</small>
              </div>
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
