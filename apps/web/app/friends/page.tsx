"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Ban,
  CarFront,
  Clock3,
  Lightbulb,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

import { useAuthFailure } from "../../src/auth/use-auth-failure";
import {
  ProfileSocialActions,
  RelationActions,
} from "../../src/social/actions";
import { socialApi } from "../../src/social/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";
import { InboxContent } from "../inbox/inbox-content";

const tabs = {
  messages: "Tin nhắn",
  friends: "Bạn bè",
  incoming: "Lời mời đến",
  outgoing: "Đã gửi",
  blocks: "Đã chặn",
} as const;

type SocialTab = keyof typeof tabs;

export default function FriendsPage() {
  const [tab, setTab] = useState<SocialTab>("messages");
  const relationTab = tab === "messages" ? "friends" : tab;
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearch("");
    setText("");
    searchToggle.current?.focus();
  };
  const list = useInfiniteQuery({
    queryKey: ["social", "list", relationTab],
    enabled: tab !== "messages",
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => socialApi.list(relationTab, pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const friendSummary = useQuery({
    queryKey: ["social", "summary", "friends"],
    queryFn: () => socialApi.list("friends"),
  });
  const incomingSummary = useQuery({
    queryKey: ["social", "summary", "incoming"],
    queryFn: () => socialApi.list("incoming"),
  });
  const outgoingSummary = useQuery({
    queryKey: ["social", "summary", "outgoing"],
    queryFn: () => socialApi.list("outgoing"),
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
  const counts = {
    friends: friendSummary.data?.items.length ?? 0,
    incoming: incomingSummary.data?.items.length ?? 0,
    outgoing: outgoingSummary.data?.items.length ?? 0,
  };

  return (
    <main className="friends-redesign-page">
      <section className="friends-hero">
        <div className="friends-hero-inner">
          <div className="friends-hero-copy">
            <p>Mạng lưới tin cậy</p>
            <h1>Bạn bè</h1>
            <span>
              Kết nối với những người bạn tin tưởng để chia sẻ hành trình nhanh
              hơn và an tâm hơn.
            </span>
            <div className="friends-stats" aria-label="Thống kê quan hệ">
              <FriendStat
                icon={Users}
                value={counts.friends}
                label="Bạn bè"
                tone="green"
              />
              <FriendStat
                icon={Clock3}
                value={counts.incoming}
                label="Lời mời đến"
                tone="amber"
              />
              <FriendStat
                icon={Send}
                value={counts.outgoing}
                label="Đã gửi lời mời"
                tone="green"
              />
            </div>
          </div>

          <div className="friends-hero-visual" aria-hidden="true">
            <span className="friends-visual-shield">
              <Users size={54} />
            </span>
            <span className="friends-visual-car">
              <CarFront size={45} />
            </span>
            <i className="friends-visual-road" />
            <i className="friends-visual-tree friends-visual-tree--one" />
            <i className="friends-visual-tree friends-visual-tree--two" />
          </div>
        </div>
      </section>

      <section className="friends-content">
        <div className="friends-toolbar">
          <nav className="friends-tabs" aria-label="Quan hệ">
            {Object.entries(tabs).map(([key, label]) => {
              const count =
                key === "incoming"
                  ? counts.incoming
                  : key === "outgoing"
                    ? counts.outgoing
                    : undefined;
              return (
                <button
                  type="button"
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key as SocialTab)}
                >
                  {label}
                  {count ? <b aria-hidden="true">{count}</b> : null}
                </button>
              );
            })}
          </nav>
          <button
            ref={searchToggle}
            className="friends-search-toggle"
            type="button"
            aria-label={searchOpen ? "Đóng tìm kiếm bạn bè" : "Tìm bạn bè"}
            title="Tìm bạn bè"
            aria-expanded={searchOpen}
            aria-controls="friends-member-search"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            <Search aria-hidden="true" size={20} />
            <span>Tìm bạn bè</span>
          </button>
        </div>
        {searchOpen ? (
          <form
            id="friends-member-search"
            className="friends-search-card"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeSearch();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(text.trim());
            }}
          >
            <div>
              <h2>Tìm người quen</h2>
              <p>Tìm kiếm thành viên theo tên để gửi lời mời kết bạn.</p>
            </div>
            <label className="friends-search-input" htmlFor="social-search">
              <Search aria-hidden="true" size={20} />
              <span className="sr-only">Tìm thành viên theo tên</span>
              <input
                ref={searchInput}
                id="social-search"
                value={text}
                minLength={2}
                maxLength={80}
                onChange={(event) => setText(event.target.value)}
                placeholder="Ví dụ: Minh Anh"
              />
            </label>
            <button
              className="friends-search-button"
              type="submit"
              disabled={text.trim().length < 2}
            >
              <Search aria-hidden="true" size={18} />
              Tìm người
            </button>
            <button
              className="friends-search-close"
              type="button"
              aria-label="Đóng tìm kiếm thành viên"
              onClick={closeSearch}
            >
              <X aria-hidden="true" size={18} />
            </button>
          </form>
        ) : null}

        {search ? (
          <section
            className="friends-search-results"
            aria-label="Kết quả tìm kiếm"
          >
            <div className="friends-section-title">
              <p>Kết quả cho “{search}”</p>
              <span>{results.data?.items.length ?? 0} thành viên</span>
            </div>
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
              <div className="friends-person-list">
                {results.data.items.map((user) => (
                  <article className="friends-person-card" key={user.userId}>
                    <span className="friends-avatar" aria-hidden="true">
                      {initials(user.displayName)}
                    </span>
                    <div className="friends-person-copy">
                      <Link href={`/users/${encodeURIComponent(user.userId)}`}>
                        {user.displayName}
                      </Link>
                      <small>Thành viên Diké</small>
                    </div>
                    <ProfileSocialActions userId={user.userId} />
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        <div
          className={`friends-workspace${tab === "messages" || tab === "friends" ? " friends-workspace--wide" : ""}`}
        >
          <div className="friends-list-column">
            {tab === "messages" ? (
              <section className="friends-messages" aria-label="Tin nhắn">
                <Suspense
                  fallback={<LoadingState label="Đang tải hội thoại" />}
                >
                  <InboxContent />
                </Suspense>
              </section>
            ) : (
              <section
                className="friends-list-section"
                aria-label={tabs[tab]}
                aria-live="polite"
              >
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
                    title={`Chưa có mục nào trong ${tabs[tab].toLowerCase()}.`}
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
                          onClick={() => {
                            setSearchOpen(true);
                            searchInput.current?.focus();
                          }}
                        >
                          <Search aria-hidden="true" size={17} /> Tìm bạn bè
                        </button>
                      ) : undefined
                    }
                  />
                ) : (
                  <div className="friends-person-list">
                    {items.map((item) => (
                      <article
                        className="friends-person-card"
                        key={item.userId}
                      >
                        <span className="friends-avatar" aria-hidden="true">
                          {initials(item.displayName)}
                        </span>
                        <div className="friends-person-copy">
                          {item.blockedByMe ? (
                            <p>{item.displayName}</p>
                          ) : (
                            <Link
                              href={`/users/${encodeURIComponent(item.userId)}`}
                            >
                              {item.displayName}
                            </Link>
                          )}
                          <small>
                            {item.blockedByMe
                              ? "Đã chặn"
                              : relationDescription(item.status)}
                          </small>
                        </div>
                        <RelationActions relation={item} />
                      </article>
                    ))}
                  </div>
                )}
                {list.hasNextPage ? (
                  <button
                    className="friends-load-more"
                    disabled={list.isFetchingNextPage}
                    onClick={() => void list.fetchNextPage()}
                  >
                    {list.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}
                  </button>
                ) : null}
              </section>
            )}
          </div>

          {tab !== "messages" && tab !== "friends" ? (
            <aside className="friends-safety-column">
              <section className="friends-trust-card">
                <ShieldCheck aria-hidden="true" size={30} />
                <div>
                  <h2>Cùng xây dựng hành trình an toàn hơn</h2>
                  <p>
                    Kết nối với những người bạn tin tưởng để chia sẻ lịch trình,
                    dễ dàng rủ nhau đi chung và luôn an tâm trên mọi hành trình.
                  </p>
                </div>
                <span aria-hidden="true">
                  <Users size={26} />
                  <CarFront size={34} />
                </span>
              </section>
              <section className="friends-tips-card">
                <h2>
                  <Lightbulb aria-hidden="true" size={21} /> Mẹo kết nối an toàn
                </h2>
                <SafetyTip
                  icon={Search}
                  title="Tìm kiếm bằng tên thật"
                  description="Dễ kết nối đúng người quen của bạn."
                />
                <SafetyTip
                  icon={Users}
                  title="Chỉ kết bạn với người bạn tin tưởng"
                  description="Giữ hành trình của bạn an toàn hơn."
                />
                <SafetyTip
                  icon={Ban}
                  title="Dễ dàng quản lý danh sách bạn bè"
                  description="Bạn có thể chặn hoặc hủy kết bạn bất cứ lúc nào."
                />
              </section>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function FriendStat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: "green" | "amber";
}) {
  return (
    <span className={`friends-stat friends-stat--${tone}`}>
      <i>
        <Icon aria-hidden="true" size={22} />
      </i>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function SafetyTip({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="friends-safety-tip">
      <span>
        <Icon aria-hidden="true" size={18} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi");
}

function relationDescription(status: string) {
  return (
    {
      ACCEPTED: "Bạn đồng hành",
      INCOMING: "Đã gửi lời mời cho bạn",
      OUTGOING: "Đang chờ phản hồi",
    }[status] ?? "Thành viên Diké"
  );
}
