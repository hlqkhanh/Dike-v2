"use client";
import { MemberAvatar } from "../../app/components/member-avatar";
import { PostRoute } from "./post-route";
import { PassengerRequest } from "./passenger-request";
import { isActiveResponse, ResponseProgress } from "./response-progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  CalendarClock,
  CarFront,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  Flag,
  Handshake,
  Map,
  MessageCircle,
  MoreVertical,
  Play,
  Route,
  Send,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { rideApi } from "./api";
import { journeyApi } from "../journey/api";
import { authApi } from "../auth/api";
import { useAuthFailure } from "../auth/use-auth-failure";
import { BookingTools } from "../journey/booking-tools";
import {
  RideNav,
  dateTime,
  money,
  statusName,
  useRideCommand,
} from "./dashboard";
import { ErrorState, LoadingState } from "../../app/components/app-ui";

export function PostDetail({ id }: { id: string }) {
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(
    null,
  );
  const router = useRouter();
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const post = useQuery({
    queryKey: ["feed", "detail", id],
    queryFn: () => rideApi.post(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [saved, setSaved] = useState(false);
  const [confirmResponse, setConfirmResponse] = useState(
    () => searchParams.get("action") === "respond",
  );
  const actionCommand = useRideCommand();
  const responseCommand = useRideCommand();
  const chatCommand = useRideCommand();
  useAuthFailure(post.error);
  const owner = post.data?.ownerId === session.data?.user.id;
  const responses = useQuery({
    queryKey: ["feed", "responses", id],
    queryFn: () => rideApi.postResponses(id),
    enabled: Boolean(post.data && session.data),
    refetchInterval: 15000,
  });
  const myResponse = responses.data?.find(
    (item) => item.requesterId === session.data?.user.id,
  );
  const selectedResponse = responses.data?.find(
    (item) => item.id === selectedResponseId && item.pickupCheck,
  );
  const trackedResponse = responses.data?.find(isActiveResponse);
  useEffect(() => {
    if (!post.data || !session.data || owner || post.data.status !== "OPEN")
      return;
    if (!confirmResponse) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [confirmResponse, owner, post.data, session.data]);
  const act = (action: "publish" | "close") => {
    if (!post.data) return;
    actionCommand.mutate({
      signature: `post:${id}:${post.data.version}:${action}`,
      run: (key) => rideApi.postAction(id, action, post.data.version, key),
    });
  };
  return (
    <main className="feed-detail-page">
      <h1 className="sr-only">Chi tiết bài đăng</h1>
      {post.isPending ? (
        <div className="feed-detail-state">
          <LoadingState label="Đang tải chi tiết bài đăng" />
        </div>
      ) : post.isError ? (
        <div className="feed-detail-state">
          <ErrorState
            title="Không tìm thấy bài đăng"
            message={post.error.message}
            onRetry={() => void post.refetch()}
          />
        </div>
      ) : post.data ? (
        <>
          <nav className="feed-detail-topbar" aria-label="Điều hướng bài đăng">
            <Link className="feed-detail-back" href="/home">
              <ArrowLeft aria-hidden="true" size={17} /> Quay lại bảng tin
            </Link>
          </nav>

          <div className="feed-detail-layout">
            <section className="feed-detail-main">
              <article className="feed-detail-card">
                <header className="feed-detail-author">
                  <Link
                    href={`/users/${encodeURIComponent(post.data.ownerId)}`}
                  >
                    <MemberAvatar
                      name={post.data.ownerDisplayName || "Thành viên Diké"}
                      avatarUrl={post.data.ownerAvatarUrl}
                      className="feed-detail-avatar"
                      size={44}
                    />
                    <span>
                      <strong>
                        {post.data.ownerDisplayName || "Thành viên Diké"}
                      </strong>
                      <small>{dateTime(post.data.departureAt)}</small>
                    </span>
                  </Link>
                  <span
                    className={`feed-detail-status is-${post.data.status.toLowerCase()}`}
                  >
                    {statusName(post.data.status)}
                  </span>
                  <button aria-label="Thêm tùy chọn" type="button">
                    <MoreVertical aria-hidden="true" size={19} />
                  </button>
                </header>

                <div className="feed-detail-route">
                  <span className="feed-detail-route-line" aria-hidden="true">
                    <i />
                    <b />
                    <i />
                  </span>
                  <div>
                    <span>
                      <small>Điểm đón</small>
                      <strong>{post.data.originLabel}</strong>
                    </span>
                    <span>
                      <small>Điểm đến</small>
                      <strong>{post.data.destinationLabel}</strong>
                    </span>
                  </div>
                </div>

                <div className="feed-detail-facts">
                  <span>
                    <CarFront aria-hidden="true" size={20} />
                    <strong>
                      {post.data.vehicleType === "MOTORCYCLE"
                        ? "Xe máy"
                        : "Ô tô"}
                    </strong>
                  </span>
                  <span>
                    <Users aria-hidden="true" size={20} />
                    <strong>
                      {post.data.type === "NEED_RIDE"
                        ? "Cần người đồng hành"
                        : `${post.data.remainingSeats} chỗ trống`}
                    </strong>
                  </span>
                  <span>
                    <CalendarClock aria-hidden="true" size={20} />
                    <strong>
                      {post.data.type === "NEED_RIDE"
                        ? "Cần đi nhờ"
                        : "Có chỗ đi cùng"}
                    </strong>
                  </span>
                </div>

                {post.data.note ? (
                  <blockquote>“{post.data.note}”</blockquote>
                ) : null}

                <footer className="feed-detail-actions">
                  <button
                    disabled={actionCommand.isPending}
                    onClick={() =>
                      actionCommand.mutate({
                        signature: `save:${id}:${saved}`,
                        run: async () => {
                          await rideApi.save(id, !saved);
                          setSaved((value) => !value);
                        },
                      })
                    }
                  >
                    <Bookmark
                      aria-hidden="true"
                      size={19}
                      fill={saved ? "currentColor" : "none"}
                    />
                    {saved ? "Đã lưu" : "Lưu bài"}
                  </button>
                  {!owner ? (
                    <button
                      type="button"
                      disabled={chatCommand.isPending}
                      onClick={() =>
                        chatCommand.mutate({
                          signature: `discuss-post:${id}`,
                          run: async () => {
                            const conversation =
                              await journeyApi.discussPost(id);
                            client.setQueryData(
                              ["conversation-info", conversation.id],
                              conversation,
                            );
                            await Promise.all([
                              client.invalidateQueries({
                                queryKey: ["conversations"],
                              }),
                              client.invalidateQueries({
                                queryKey: ["conversation", conversation.id],
                              }),
                            ]);
                            router.push(
                              `/friends?conversation=${encodeURIComponent(conversation.id)}&post=${encodeURIComponent(id)}`,
                            );
                          },
                        })
                      }
                    >
                      <MessageCircle aria-hidden="true" size={19} />
                      {chatCommand.isPending ? "Đang mở chat…" : "Trao đổi"}
                    </button>
                  ) : null}
                  {!owner &&
                  post.data.status === "OPEN" &&
                  (!myResponse ||
                    (post.data.type === "OFFER_RIDE" &&
                      !isActiveResponse(myResponse))) ? (
                    <button
                      className="is-primary feed-detail-connect-action"
                      type="button"
                      onClick={() => setConfirmResponse(true)}
                    >
                      <Handshake aria-hidden="true" size={19} />
                      {post.data.type === "OFFER_RIDE" &&
                      myResponse?.status === "PENDING"
                        ? "Kiểm tra lại điểm đón"
                        : post.data.type === "OFFER_RIDE"
                          ? "Đi ké ngay"
                          : "Chở ngay"}
                    </button>
                  ) : null}
                  {owner && post.data.status === "DRAFT" ? (
                    <button
                      className="is-primary"
                      disabled={actionCommand.isPending}
                      onClick={() => act("publish")}
                    >
                      <Send aria-hidden="true" size={18} /> Đăng bài
                    </button>
                  ) : null}
                  {owner &&
                  ["DRAFT", "OPEN", "MATCHED"].includes(post.data.status) ? (
                    <button
                      disabled={actionCommand.isPending}
                      onClick={() => act("close")}
                    >
                      <Check aria-hidden="true" size={18} /> Đóng bài
                    </button>
                  ) : null}
                </footer>
                {chatCommand.isError ? (
                  <p className="auth-error" role="alert">
                    {chatCommand.error.message}
                  </p>
                ) : null}
                {actionCommand.isError ? (
                  <p className="feed-detail-feedback" role="alert">
                    {actionCommand.error.message}
                  </p>
                ) : null}
                {actionCommand.isSuccess ? (
                  <p className="feed-detail-feedback is-success" role="status">
                    Đã cập nhật bài đăng.
                  </p>
                ) : null}
                {!owner && myResponse ? (
                  <div
                    className={`feed-response-summary is-${myResponse.status.toLowerCase()}`}
                  >
                    <span>
                      <strong>
                        {myResponse.status === "PENDING"
                          ? "Đang chờ người đăng xác nhận"
                          : isActiveResponse(myResponse)
                            ? "Người đăng đã xác nhận"
                            : myResponse.status === "REJECTED"
                              ? "Người đăng đã từ chối"
                              : "Bạn đã rút yêu cầu"}
                      </strong>
                      <small>
                        {isActiveResponse(myResponse)
                          ? "Theo dõi tiến độ chuyến đi và các cập nhật từ người chở."
                          : "Trạng thái được cập nhật tự động mỗi 15 giây."}
                      </small>
                    </span>
                    {myResponse.status === "PENDING" ? (
                      <button
                        type="button"
                        disabled={responseCommand.isPending}
                        onClick={() =>
                          responseCommand.mutate({
                            signature: `post-response:${myResponse.id}:${myResponse.version}:withdraw`,
                            run: () =>
                              rideApi.decidePostResponse(
                                myResponse.id,
                                myResponse.version,
                                "WITHDRAWN",
                              ),
                          })
                        }
                      >
                        Rút yêu cầu
                      </button>
                    ) : isActiveResponse(myResponse) ? (
                      <Link
                        href={
                          myResponse.conversationId
                            ? `/friends?conversation=${encodeURIComponent(myResponse.conversationId)}`
                            : "/friends"
                        }
                      >
                        Bắt đầu trao đổi
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                {!owner && myResponse && isActiveResponse(myResponse) ? (
                  <ResponseProgress
                    response={myResponse}
                    currentUserId={session.data?.user.id ?? ""}
                    onUpdated={() => void responses.refetch()}
                  />
                ) : null}

                {owner && responses.data?.length ? (
                  <section
                    className="feed-response-owner-panel"
                    aria-labelledby="response-heading"
                  >
                    <div>
                      <p>Yêu cầu kết nối</p>
                      <h2 id="response-heading">Xác nhận người đồng hành</h2>
                    </div>
                    {trackedResponse ? (
                      <>
                        <ResponseProgress
                          response={trackedResponse}
                          currentUserId={session.data?.user.id ?? ""}
                          onUpdated={() => void responses.refetch()}
                        />
                        <div className="feed-response-progress-note">
                          <ShieldCheck aria-hidden="true" size={17} />
                          <span>
                            Người đồng hành đã được xác nhận. Hệ thống sẽ cập
                            nhật tiến trình chuyến đi theo thời gian thực.
                          </span>
                        </div>
                      </>
                    ) : null}
                    {responses.data.map((item) => (
                      <article
                        className={`feed-response-request is-${item.status.toLowerCase()} ${item.pickupCheck ? "has-pickup" : ""} ${selectedResponseId === item.id ? "is-map-selected" : ""}`}
                        key={item.id}
                        tabIndex={item.pickupCheck ? 0 : undefined}
                        aria-label={
                          item.pickupCheck
                            ? `Hiển thị tuyến đón của ${item.requesterDisplayName || "Thành viên Diké"} trên bản đồ`
                            : undefined
                        }
                        onClick={() => {
                          if (item.pickupCheck) {
                            setSelectedResponseId((current) =>
                              current === item.id ? null : item.id,
                            );
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            item.pickupCheck &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setSelectedResponseId((current) =>
                              current === item.id ? null : item.id,
                            );
                          }
                        }}
                      >
                        <Link
                          className="feed-response-requester"
                          href={`/profile/${encodeURIComponent(item.requesterId)}`}
                          aria-label={`Xem hồ sơ của ${item.requesterDisplayName || "Thành viên Diké"}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span
                            className="feed-response-avatar"
                            aria-hidden="true"
                            style={
                              item.requesterAvatarUrl
                                ? {
                                    backgroundImage: `url(${item.requesterAvatarUrl})`,
                                  }
                                : undefined
                            }
                          >
                            {!item.requesterAvatarUrl
                              ? initials(
                                  item.requesterDisplayName ||
                                    "Thành viên Diké",
                                )
                              : null}
                          </span>
                          <span>
                            <strong>
                              {item.requesterDisplayName || "Thành viên Diké"}
                            </strong>
                            <small>
                              <UserRound aria-hidden="true" size={15} />
                              {item.action === "REQUEST_RIDE"
                                ? "Muốn đi ké"
                                : "Muốn chở bạn"}
                            </small>
                            <time dateTime={item.createdAt}>
                              Đã gửi yêu cầu {responseAge(item.createdAt)}
                            </time>
                          </span>
                        </Link>

                        <div className="feed-response-request-message">
                          <span>
                            <MessageCircle aria-hidden="true" size={16} />
                            Tin nhắn
                          </span>
                          <p>
                            {item.message || "Người gửi không để lại lời nhắn."}
                          </p>
                        </div>

                        <div className="feed-response-decision">
                          <strong className="feed-response-status">
                            {item.status === "PENDING" ? (
                              <Clock3 aria-hidden="true" size={18} />
                            ) : isActiveResponse(item) ? (
                              <Check aria-hidden="true" size={18} />
                            ) : (
                              <XCircle aria-hidden="true" size={18} />
                            )}
                            {item.status === "PENDING"
                              ? "Đang chờ phản hồi"
                              : isActiveResponse(item)
                                ? "Đã xác nhận"
                                : item.status === "REJECTED"
                                  ? "Đã từ chối"
                                  : "Đã rút yêu cầu"}
                          </strong>
                          {item.status === "PENDING" ? (
                            <div className="feed-response-buttons">
                              <button
                                type="button"
                                disabled={responseCommand.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  responseCommand.mutate({
                                    signature: `post-response:${item.id}:${item.version}:reject`,
                                    run: () =>
                                      rideApi.decidePostResponse(
                                        item.id,
                                        item.version,
                                        "REJECTED",
                                      ),
                                  });
                                }}
                              >
                                Từ chối
                              </button>
                              <button
                                className="is-accept"
                                type="button"
                                disabled={responseCommand.isPending}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  responseCommand.mutate({
                                    signature: `post-response:${item.id}:${item.version}:accept`,
                                    run: () =>
                                      rideApi.decidePostResponse(
                                        item.id,
                                        item.version,
                                        "ACCEPTED",
                                      ),
                                  });
                                }}
                              >
                                Xác nhận
                              </button>
                            </div>
                          ) : isActiveResponse(item) ? (
                            <small className="feed-response-confirmed-copy">
                              <Check aria-hidden="true" size={15} />
                              {item.status === "COMPLETED"
                                ? "Chuyến đi đã hoàn thành"
                                : item.status === "DRIVER_ARRIVED"
                                  ? "Người chở đã đến điểm đón"
                                  : item.status === "DRIVER_STARTED"
                                    ? "Người chở đang đến đón"
                                    : "Đã trở thành người đồng hành"}
                            </small>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </section>
                ) : null}
                {responseCommand.isError ? (
                  <p className="feed-detail-feedback" role="alert">
                    {responseCommand.error.message}
                  </p>
                ) : null}
              </article>

              {confirmResponse &&
              !owner &&
              post.data.status === "OPEN" &&
              post.data.type === "OFFER_RIDE" ? (
                <PassengerRequest
                  key={id}
                  post={post.data}
                  onClose={() => setConfirmResponse(false)}
                  onSent={() => void responses.refetch()}
                />
              ) : confirmResponse && !owner && post.data.status === "OPEN" ? (
                <div className="feed-response-modal" role="presentation">
                  <section
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="response-confirm-title"
                  >
                    <span
                      className="feed-response-modal-icon"
                      aria-hidden="true"
                    >
                      <Handshake size={25} />
                    </span>
                    <h2 id="response-confirm-title">
                      {post.data.type === "OFFER_RIDE"
                        ? "Xác nhận muốn đi ké?"
                        : "Xác nhận muốn chở thành viên này?"}
                    </h2>
                    <p>
                      Yêu cầu sẽ được gửi tới người đăng. Chỉ sau khi họ xác
                      nhận, hai bên mới tiếp tục trao đổi thông tin chuyến đi.
                    </p>
                    <dl>
                      <div>
                        <dt>Điểm đón</dt>
                        <dd>{post.data.originLabel}</dd>
                      </div>
                      <div>
                        <dt>Điểm đến</dt>
                        <dd>{post.data.destinationLabel}</dd>
                      </div>
                      <div>
                        <dt>Khởi hành</dt>
                        <dd>{dateTime(post.data.departureAt)}</dd>
                      </div>
                    </dl>
                    <div className="feed-response-modal-actions">
                      <button
                        type="button"
                        onClick={() => setConfirmResponse(false)}
                      >
                        Quay lại
                      </button>
                      <button
                        className="is-confirm"
                        type="button"
                        disabled={responseCommand.isPending}
                        onClick={() =>
                          responseCommand.mutate(
                            {
                              signature: `post-response:${id}:create`,
                              run: () => rideApi.createPostResponse(id),
                            },
                            { onSuccess: () => setConfirmResponse(false) },
                          )
                        }
                      >
                        {responseCommand.isPending
                          ? "Đang gửi…"
                          : "Gửi yêu cầu"}
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </section>

            <aside className="feed-detail-sidebar">
              <section className="feed-detail-map-card">
                <h2>
                  <span>
                    <Map aria-hidden="true" size={20} />
                  </span>
                  Tuyến đường
                </h2>
                <PostRoute
                  id={id}
                  origin={post.data.originLabel}
                  destination={post.data.destinationLabel}
                  pickupCheck={selectedResponse?.pickupCheck ?? undefined}
                  driver={{
                    name: post.data.ownerDisplayName || "Người đăng chuyến",
                    avatarUrl: post.data.ownerAvatarUrl,
                  }}
                  passenger={
                    selectedResponse
                      ? {
                          name:
                            selectedResponse.requesterDisplayName ||
                            "Thành viên Diké",
                          avatarUrl: selectedResponse.requesterAvatarUrl,
                        }
                      : undefined
                  }
                />
                {!selectedResponse ? (
                  <dl>
                    <div>
                      <dt>
                        <CalendarClock aria-hidden="true" size={18} /> Khởi hành
                      </dt>
                      <dd>{dateTime(post.data.departureAt)}</dd>
                    </div>
                    <div>
                      <dt>
                        <Clock3 aria-hidden="true" size={18} /> Bài hết hạn
                      </dt>
                      <dd>{dateTime(post.data.expiresAt)}</dd>
                    </div>
                  </dl>
                ) : null}
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("vi-VN");
}

function responseAge(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export function TripDetail({ id }: { id: string }) {
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    const update = () => setCurrentTime(Date.now());
    update();
    const timer = window.setInterval(update, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const trip = useQuery({
    queryKey: ["rides", "trip", id],
    queryFn: () => rideApi.trip(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [reason, setReason] = useState("");
  const command = useRideCommand();
  useAuthFailure(trip.error);
  const act = (action: string) => {
    if (!trip.data) return;
    const version = trip.data.version;
    command.mutate({
      signature: `trip:${id}:${version}:${action}:${reason}`,
      run: (key) =>
        action === "open"
          ? rideApi.openTrip(id, version, key)
          : rideApi.tripAction(id, { version, action, reason }, key),
    });
  };
  const visibilityName =
    trip.data?.visibility === "FRIENDS" ? "Chỉ bạn bè" : "Công khai";
  const vehicleName =
    trip.data?.vehicleType === "MOTORCYCLE" ? "Xe máy" : "Ô tô";
  const isDraft = trip.data?.status === "DRAFT";
  const startAvailableAt = trip.data
    ? new Date(trip.data.departureAt).getTime() - 15 * 60 * 1000
    : 0;
  const canStart = currentTime > 0 && currentTime >= startAvailableAt;
  const commandErrorCode = (command.error as { code?: string } | null)?.code;
  return (
    <main className="trip-detail-page">
      {trip.isPending ? (
        <div className="trip-detail-state">
          <LoadingState label="Đang tải chi tiết chuyến" />
        </div>
      ) : trip.isError ? (
        <div className="trip-detail-state">
          <ErrorState
            message={trip.error.message}
            onRetry={() => void trip.refetch()}
          />
        </div>
      ) : trip.data ? (
        <>
          <section className="trip-detail-hero">
            <div className="trip-detail-hero-inner">
              <Link className="trip-detail-back" href="/trips">
                <ArrowLeft aria-hidden="true" size={17} /> Quay lại chuyến của
                tôi
              </Link>
              <div className="trip-detail-hero-copy">
                <div>
                  <p>
                    {isDraft ? "Bản nháp đã được tạo" : "Quản lý hành trình"}
                  </p>
                  <h1>
                    {isDraft
                      ? "Kiểm tra và đăng chuyến"
                      : "Thông tin chuyến đi"}
                  </h1>
                  <span>
                    {isDraft
                      ? "Chuyến chưa hiển thị với cộng đồng. Hãy kiểm tra thông tin trước khi đăng."
                      : "Theo dõi lộ trình, chỗ ngồi và trạng thái hành trình của bạn."}
                  </span>
                </div>
                <span
                  className={`trip-detail-status trip-detail-status--${trip.data.status.toLowerCase()}`}
                >
                  {statusName(trip.data.status)}
                </span>
              </div>

              <nav
                className="trip-detail-stepper"
                aria-label="Tiến độ tạo chuyến"
              >
                <div className="is-complete">
                  <span>
                    <Check aria-hidden="true" size={16} />
                  </span>
                  <strong>Chọn tuyến đường</strong>
                </div>
                <i aria-hidden="true" />
                <div className="is-complete">
                  <span>
                    <Check aria-hidden="true" size={16} />
                  </span>
                  <strong>Thông tin chuyến</strong>
                </div>
                <i aria-hidden="true" />
                <div className="is-active">
                  <span>3</span>
                  <strong>Xác nhận</strong>
                </div>
              </nav>
            </div>
          </section>

          <div className="trip-detail-layout">
            <section className="trip-detail-main">
              {isDraft ? (
                <div className="trip-detail-draft-notice" role="status">
                  <ShieldCheck aria-hidden="true" size={21} />
                  <span>
                    <strong>Chuyến đang ở chế độ bản nháp</strong>
                    Chỉ bạn nhìn thấy chuyến này cho đến khi chọn “Đăng chuyến”.
                  </span>
                </div>
              ) : null}

              <article className="trip-detail-card trip-detail-route-card">
                <div className="trip-detail-section-heading">
                  <span>
                    <Route aria-hidden="true" size={20} />
                  </span>
                  <div>
                    <p>Lộ trình chuyến đi</p>
                    <h2>Điểm đón và điểm đến</h2>
                    <small>
                      Thông tin đã được lưu từ tuyến đường bạn chọn.
                    </small>
                  </div>
                </div>

                <div className="trip-detail-route">
                  <div className="trip-detail-route-marker">
                    <i className="is-origin" />
                    <b aria-hidden="true" />
                    <i className="is-destination" />
                  </div>
                  <div className="trip-detail-route-copy">
                    <span>
                      <small>Điểm đi</small>
                      <strong>{trip.data.originLabel}</strong>
                    </span>
                    <span>
                      <small>Điểm đến</small>
                      <strong>{trip.data.destinationLabel}</strong>
                    </span>
                  </div>
                </div>

                <div className="trip-detail-quick-facts">
                  <span>
                    <CalendarClock aria-hidden="true" size={18} />
                    <small>Khởi hành</small>
                    <strong>{dateTime(trip.data.departureAt)}</strong>
                  </span>
                  <span>
                    <Users aria-hidden="true" size={18} />
                    <small>Chỗ trống</small>
                    <strong>
                      {trip.data.remainingSeats}/{trip.data.offeredSeats} chỗ
                    </strong>
                  </span>
                  <span>
                    <CircleDollarSign aria-hidden="true" size={18} />
                    <small>Đóng góp</small>
                    <strong>{money(trip.data.contributionPerKm)}/km</strong>
                  </span>
                </div>
              </article>

              {session.data?.user.id === trip.data.driverId ? (
                <section className="trip-detail-card trip-detail-actions-card">
                  <div className="trip-detail-section-heading">
                    <span>
                      <Flag aria-hidden="true" size={20} />
                    </span>
                    <div>
                      <p>Quản lý chuyến</p>
                      <h2>
                        {isDraft
                          ? "Sẵn sàng đăng chuyến?"
                          : "Cập nhật hành trình"}
                      </h2>
                      <small>
                        {isDraft
                          ? "Sau khi đăng, chuyến sẽ hiển thị theo phạm vi bạn đã chọn."
                          : "Chỉ cập nhật trạng thái khi hành trình thực tế thay đổi."}
                      </small>
                    </div>
                  </div>

                  {isDraft ? (
                    <button
                      className="trip-detail-primary-action"
                      disabled={command.isPending}
                      onClick={() => act("open")}
                    >
                      <Eye aria-hidden="true" size={18} />
                      {command.isPending ? "Đang đăng chuyến…" : "Đăng chuyến"}
                    </button>
                  ) : null}

                  {["OPEN", "FULL"].includes(trip.data.status) ? (
                    <>
                      <button
                        className="trip-detail-primary-action"
                        disabled={command.isPending || !canStart}
                        onClick={() => act("start")}
                      >
                        <Play aria-hidden="true" size={18} /> Bắt đầu chuyến
                      </button>
                      {!canStart ? (
                        <p className="trip-detail-feedback" role="status">
                          Bạn có thể bắt đầu chuyến từ{" "}
                          {dateTime(new Date(startAvailableAt).toISOString())}{" "}
                          (15 phút trước giờ khởi hành).
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {trip.data.status === "IN_PROGRESS" ? (
                    <button
                      className="trip-detail-primary-action"
                      disabled={command.isPending}
                      onClick={() => act("complete")}
                    >
                      <Check aria-hidden="true" size={18} /> Hoàn tất chuyến
                    </button>
                  ) : null}

                  {["DRAFT", "OPEN", "FULL"].includes(trip.data.status) ? (
                    <div className="trip-detail-cancel-area">
                      <label>
                        <span>Lý do hủy chuyến</span>
                        <textarea
                          value={reason}
                          maxLength={500}
                          placeholder="Cho người đồng hành biết lý do bạn hủy chuyến"
                          onChange={(event) => setReason(event.target.value)}
                        />
                      </label>
                      <button
                        className="trip-detail-cancel-action"
                        disabled={command.isPending || !reason.trim()}
                        onClick={() => act("cancel")}
                      >
                        <XCircle aria-hidden="true" size={18} /> Hủy chuyến
                      </button>
                    </div>
                  ) : null}

                  {command.isPending && !isDraft ? (
                    <p className="trip-detail-feedback" role="status">
                      Đang cập nhật chuyến…
                    </p>
                  ) : null}
                  {command.isSuccess ? (
                    <p
                      className="trip-detail-feedback is-success"
                      role="status"
                    >
                      Trạng thái chuyến đã được cập nhật.
                    </p>
                  ) : null}
                  {command.isError ? (
                    <p className="trip-detail-feedback is-error" role="alert">
                      {commandErrorCode === "TOO_EARLY_TO_START"
                        ? "Chưa đến thời gian bắt đầu. Bạn chỉ có thể bắt đầu trong vòng 15 phút trước giờ khởi hành."
                        : command.error.message}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </section>

            <aside
              className="trip-detail-summary"
              aria-label="Thông tin chuyến"
            >
              <div className="trip-detail-summary-card">
                <div className="trip-detail-summary-heading">
                  <div>
                    <p>Tóm tắt chuyến đi</p>
                    <h2>Thông tin đã xác nhận</h2>
                  </div>
                  <CarFront aria-hidden="true" size={22} />
                </div>
                <dl className="trip-detail-fact-list">
                  <div>
                    <dt>
                      <CalendarClock aria-hidden="true" size={18} /> Khởi hành
                    </dt>
                    <dd>{dateTime(trip.data.departureAt)}</dd>
                  </div>
                  <div>
                    <dt>
                      <Clock3 aria-hidden="true" size={18} /> Dự kiến đến
                    </dt>
                    <dd>{dateTime(trip.data.arrivalAt)}</dd>
                  </div>
                  <div>
                    <dt>
                      <Users aria-hidden="true" size={18} /> Chỗ ngồi
                    </dt>
                    <dd>
                      Còn {trip.data.remainingSeats}/{trip.data.offeredSeats}{" "}
                      chỗ
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <CircleDollarSign aria-hidden="true" size={18} /> Mức đóng
                      góp
                    </dt>
                    <dd>{money(trip.data.contributionPerKm)}/km</dd>
                  </div>
                  <div>
                    <dt>
                      <CarFront aria-hidden="true" size={18} /> Phương tiện
                    </dt>
                    <dd>{vehicleName}</dd>
                  </div>
                  <div>
                    <dt>
                      <Eye aria-hidden="true" size={18} /> Phạm vi hiển thị
                    </dt>
                    <dd>{visibilityName}</dd>
                  </div>
                </dl>

                <Link
                  className="trip-detail-edit-route"
                  href="/rides/new?mode=driver"
                >
                  <Route aria-hidden="true" size={17} /> Tạo chuyến với tuyến
                  khác
                </Link>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const booking = useQuery({
    queryKey: ["rides", "booking", id],
    queryFn: () => rideApi.booking(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [visibleCode, setVisibleCode] = useState<{
    code: string;
    version: number;
  } | null>(null);
  const [codeError, setCodeError] = useState("");
  const command = useRideCommand();
  useAuthFailure(booking.error);
  const act = (action: string) => {
    if (!booking.data) return;
    const version = booking.data.version;
    setVisibleCode(null);
    command.mutate({
      signature: `booking:${id}:${version}:${action}:${reason}`,
      run: (key) =>
        rideApi.bookingAction(id, { version, action, reason, code }, key),
    });
    setCode("");
  };
  const b = booking.data;
  const driver = b?.driverId === session.data?.user.id;
  const waiting = b && ["CONFIRMED", "DRIVER_ARRIVED"].includes(b.status);
  const aboard = b && ["BOARDED", "IN_PROGRESS"].includes(b.status);
  return (
    <main className="settings-page">
      <h1>Chi tiết booking</h1>
      <RideNav />
      {booking.isPending ? (
        <p>Đang tải…</p>
      ) : booking.isError ? (
        <p role="alert">{booking.error.message}</p>
      ) : b ? (
        <>
          <article className="settings-card">
            <h2>{statusName(b.status)}</h2>
            {!driver &&
            ["CANCELLED", "NO_SHOW", "ENDED_EARLY"].includes(b.status) ? (
              <button
                disabled={command.isPending}
                onClick={() =>
                  command.mutate({
                    signature: `again:${id}:${b.version}`,
                    run: async (key) => {
                      const result = await rideApi.findAgain(
                        id,
                        b.version,
                        key,
                      );
                      router.push(`/feed/${encodeURIComponent(result.postId)}`);
                      return result;
                    },
                  })
                }
              >
                Tìm lại chuyến từ bản nháp mới
              </button>
            ) : null}
            <p>
              Đón {dateTime(b.pickupAt)} · Đến {dateTime(b.dropoffAt)}
            </p>
            <p>Mức đóng góp đã chốt: {money(b.priceVnd)}</p>
            {b.reason ? <p>Lý do: {b.reason}</p> : null}
            {waiting && !driver ? (
              <div>
                <button
                  onClick={() => {
                    if (visibleCode) {
                      setVisibleCode(null);
                      return;
                    }
                    void rideApi
                      .boardingCode(id)
                      .then((value) => {
                        setVisibleCode({
                          code: value.code,
                          version: b.version,
                        });
                        setCodeError("");
                      })
                      .catch((error: Error) => setCodeError(error.message));
                  }}
                >
                  {visibleCode?.version === b.version
                    ? "Ẩn mã lên xe"
                    : "Xem mã lên xe"}
                </button>
                {visibleCode?.version === b.version ? (
                  <p role="status">
                    Mã lên xe: <strong>{visibleCode.code}</strong>
                  </p>
                ) : null}
                {codeError ? <p role="alert">{codeError}</p> : null}
              </div>
            ) : null}
            {waiting && driver ? (
              <label>
                Mã lên xe do hành khách cung cấp
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
            ) : null}
            {waiting || aboard ? (
              <label>
                Lý do hủy, vắng mặt hoặc kết thúc sớm
                <textarea
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            ) : null}
            <div className="social-tabs">
              {driver && b.status === "CONFIRMED" ? (
                <button
                  disabled={command.isPending}
                  onClick={() => act("ARRIVE")}
                >
                  Đã đến điểm đón
                </button>
              ) : null}
              {driver && waiting ? (
                <>
                  <button
                    disabled={command.isPending || code.length !== 6}
                    onClick={() => act("BOARD")}
                  >
                    Xác nhận lên xe
                  </button>
                  <button
                    disabled={
                      command.isPending ||
                      !reason.trim() ||
                      now < new Date(b.pickupAt).getTime() + 600000
                    }
                    onClick={() => act("NO_SHOW")}
                  >
                    Khách không có mặt
                  </button>
                </>
              ) : null}
              {waiting ? (
                <button
                  disabled={command.isPending || !reason.trim()}
                  onClick={() => act("CANCEL")}
                >
                  Hủy booking
                </button>
              ) : null}
              {aboard ? (
                <button
                  disabled={command.isPending || !reason.trim()}
                  onClick={() => act("END_EARLY")}
                >
                  Kết thúc sớm
                </button>
              ) : null}
              {driver && b.status === "IN_PROGRESS" ? (
                <button
                  disabled={command.isPending}
                  onClick={() => act("COMPLETE")}
                >
                  Đã trả khách
                </button>
              ) : null}
            </div>
          </article>
          <BookingTools bookingId={id} driver={Boolean(driver)} />
        </>
      ) : null}
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
    </main>
  );
}
