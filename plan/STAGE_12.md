# STAGE 12 — Chat, thông báo và realtime

Ngày lập: 07/10/2026. Baseline: `8a902f6` trên `main`.
Trạng thái: Đặc tả chuyên sâu thuộc batch hợp nhất Stage 12–14; không triển khai/nghiệm thu độc lập.

Runbook thực thi chính: [STAGE_12_13_14.md](STAGE_12_13_14.md). Đọc cùng
[PLAN_MASTER](PLAN_MASTER.md) và [Stage 11](STAGE_11.md). Master plan và ADR Accepted có ưu tiên cao
hơn nếu phát sinh mâu thuẫn.

## 1. Mục tiêu, phạm vi và điều kiện đầu vào

Stage 12 cung cấp direct chat, message request, booking chat, notification bền vững và realtime
delivery. REST/MongoDB vẫn là nguồn sự thật; WebSocket chỉ giảm độ trễ và không được dùng làm
business command channel.

### Trong phạm vi

- Direct conversation duy nhất cho mỗi cặp user chuẩn hóa.
- Một opening message từ người lạ dưới dạng message request.
- Booking conversation riêng cho từng booking, không group các passenger.
- Text message, `clientMessageId`, cursor pagination, unread count và read marker.
- In-app notification bền vững.
- Spring WebSocket/STOMP `/ws`, xác thực bằng ticket Redis một lần.
- Redis Pub/Sub bridge giữa worker và API process.
- Outbox fan-out cho nhiều consumer của cùng một business event.
- Web inbox, message requests, conversation và notification center đủ để E2E.
- Email/push port, retry và fake adapter local/test; chưa gửi qua provider thật.

### Ngoài phạm vi

- Group chat, attachment, edit/delete/unsend, typing indicator, voice/video và E2E encryption.
- Presence/live GPS của Stage 13.
- Provider email/push production; mobile push thuộc Stage 16/17.
- Moderation dashboard và content enforcement của Stage 14.
- UI polish toàn sản phẩm của Stage 15.

### Gate đầu vào

| Gate   | Yêu cầu                                                                   |
| ------ | ------------------------------------------------------------------------- |
| G12-01 | Stage 2 session/CSRF/Origin hoạt động qua same-origin REST proxy          |
| G12-02 | Stage 6 friendship, block và `allowMessageRequests` là authoritative      |
| G12-03 | Stage 11 có booking participant/status và outbox event versioned          |
| G12-04 | Mongo replica set, Redis, worker profile và outbox retry đang xanh        |
| G12-05 | OpenAPI/generated TypeScript client và multi-browser Playwright hoạt động |

Stage 12 preflight phải chạy lại gate thực tế; không suy luận “đã xong” chỉ từ tài liệu.

## 2. Quyết định kiến trúc đã khóa

### 2.1. WebSocket production

HTTP của browser tiếp tục dùng `/api/*` qua Next.js/Vercel. WebSocket kết nối trực tiếp tới public
Spring API vì không phụ thuộc Vercel làm WebSocket server dài hạn.

Luồng:

1. Browser đã đăng nhập gọi `POST /api/v1/realtime/tickets` qua same-origin proxy.
2. Spring tạo opaque ticket 256-bit, TTL 30 giây, lưu hash trong Redis.
3. Browser mở native WebSocket tới public `/ws` của Spring.
4. Ticket được gửi trong STOMP `CONNECT`, không nằm trong URL.
5. Inbound interceptor atomic-consume ticket, gắn `DikePrincipal` rồi mới cho subscribe.
6. Ticket hết hạn, đã dùng, sai origin hoặc sai authorization version bị từ chối và đóng socket.

Dùng `@stomp/stompjs`; không dùng SockJS. Tạo ADR mới cho ticket và Redis realtime bridge, đồng
thời cập nhật ADR 0004/0011. Ticket/CONNECT header/session ID không được log.

### 2.2. Destination

Private payload chỉ phát theo user destination:

```text
/user/queue/notifications
/user/queue/proposals
/user/queue/bookings
/user/queue/conversations
```

`/topic/trips/{tripId}` chỉ mang trạng thái chuyến không chứa tọa độ hoặc dữ liệu passenger khác.
Không phát message body qua `/topic/conversations/{conversationId}` trong v1; cách này tránh một
subscription cũ tiếp tục nhận dữ liệu sau khi block/privacy thay đổi.

Business command như gửi message, accept request và mark read đi qua REST/idempotency. Client
`SEND` tới destination nghiệp vụ bị từ chối.

### 2.3. API/worker separation

Worker không có WebSocket server. Realtime đi theo luồng:

```text
Mongo transaction → Outbox → Worker consumer
                         ├─ ghi notification/projection bền vững
                         └─ publish RealtimeEnvelope vào Redis Pub/Sub
                                                ↓
                                      API Redis subscriber
                                                ↓
                                        STOMP user queue
```

Redis Pub/Sub là best-effort. Khi mất event, REST reconciliation phục hồi trạng thái. Redis lỗi
không rollback message/booking đã commit.

## 3. Nâng cấp outbox fan-out

Hiện registry chỉ cho một handler trên mỗi `(eventType, payloadVersion)`. Stage 12 đổi contract:

```java
interface OutboxHandler {
  String consumerName();
  Set<String> eventTypes();
  int payloadVersion();
  void handle(OutboxEvent event);
}
```

Tạo collection `outbox_deliveries`:

- `eventId`, `consumerName`.
- `status`: `PROCESSING`, `COMPLETED`, `RETRY`, `FAILED`.
- `attempts`, `nextAttemptAt`, `lockedUntil`, `lockedBy`.
- `lastError`, `completedAt`, `createdAt`.
- Unique `(eventId, consumerName)`.

Quy tắc worker:

- Claim từng delivery bằng atomic operation; skip consumer đã hoàn thành.
- Event chỉ `COMPLETED` khi mọi consumer đăng ký của version đó hoàn thành.
- Retry không chạy lại consumer đã thành công.
- Handler side effect phải idempotent theo `eventId` hoặc business key.
- Consumer mới không tự đọc lại event cũ đã hoàn thành; stage sở hữu backfill/reconciliation.
- Existing handler có `consumerName` ổn định, không dùng tên class có thể refactor.
- Failed consumer có metric, alert và controlled replay; không sửa event payload bằng tay.

Migration dùng namespace `V012_0__outbox_fanout_deliveries`.

## 4. Ownership và mô hình dữ liệu

`messaging` sở hữu Conversation, Participant, MessageRequest, Message, Notification và delivery.
Module khác chỉ dùng public application API hoặc versioned outbox event.

### 4.1. Conversation

```text
id
type: DIRECT | BOOKING
pairKey                 // minUserId:maxUserId cho DIRECT
bookingId               // chỉ BOOKING
participantIds[2]
state: REQUEST_PENDING | OPEN
createdAt
lastMessageAt
lastMessageId
nextSequence
version
```

Indexes:

- Unique partial `(type=DIRECT, pairKey)`.
- Unique partial `(type=BOOKING, bookingId)`.
- `(participantIds, lastMessageAt desc, id desc)`.

`READ_ONLY` là projection từ block/friendship/privacy/booking status hiện tại, không phải trạng thái
cố định có thể bị stale.

### 4.2. ConversationParticipant

```text
conversationId
userId
lastReadSequence
unreadCount
lastReadAt
version
```

Unique `(conversationId, userId)`. Gửi message tăng unread recipient trong cùng transaction. Mark
read cập nhật tới sequence hợp lệ; race send/read phải serialize bằng expected version/transaction.
Reconciliation có thể tính lại unread từ messages nhưng không chạy ở request path bình thường.

### 4.3. MessageRequest

```text
id
conversationId
senderId
recipientId
openingMessageId
status: PENDING | ACCEPTED | DECLINED
createdAt
decidedAt
declinedUntil
version
```

- Stranger chỉ có một opening message khi pending.
- Decline đặt cooldown đúng cặp/chiều trong 7 ngày.
- Accept không tự kết bạn.
- Friendship accepted tự mở request pending giữa cặp đó.
- Request badge tách khỏi unread conversation cho tới khi accepted.

### 4.4. Message

```text
id
conversationId
senderId
clientMessageId
sequence
text
createdAt
moderationStatus: VISIBLE | HIDDEN
version
```

Indexes:

- Unique `(conversationId, senderId, clientMessageId)`.
- Unique `(conversationId, sequence)`.
- `(conversationId, sequence desc)`.

Validation: text trim còn 1–2.000 Unicode code point; cho newline; `clientMessageId` là UUID.
Retry cùng ID/body trả message cũ; cùng ID khác body trả `IDEMPOTENCY_CONFLICT`. Không edit/delete
v1. Message bị ẩn trả placeholder cho participant, evidence vẫn tồn tại cho moderation.

### 4.5. Notification và delivery

Notification:

```text
id, recipientUserId, type, resourceType, resourceId
deduplicationKey, safeData, createdAt, readAt, version
```

Unique `(recipientUserId, deduplicationKey)`. `safeData` không chứa message body cho external
delivery, coordinate, phone/email đầy đủ, boarding code, token hoặc session ID.

Delivery:

```text
notificationId, channel: EMAIL | PUSH
recipientUserId, status: PENDING | SENT | RETRY | FAILED | DISABLED
attempts, nextAttemptAt, providerMessageId, lastErrorCode
```

Local/test dùng fake adapter. Hosted environment giữ `DISABLED` nếu chưa có provider reviewed.

Migration dữ liệu messaging dùng `V012_1__messaging_notification_indexes`.

## 5. Policy chat

### Direct chat

- Friend tạo/lấy conversation và nhắn hai chiều.
- Stranger chỉ gửi message request nếu recipient bật `allowMessageRequests`.
- Accept request mở chat nhưng không tạo friendship.
- Unfriend giữ history; nếu recipient cho stranger thì chat tiếp tục, nếu friends-only thì read-only.
- Block ngăn gửi hai chiều và tạo request mới nhưng không xóa history/evidence.
- Mọi read/write kiểm tra live policy, không tin policy snapshot từ client/cache.

### Booking chat

- Consumer `booking.confirmed` tạo idempotent một conversation cho đúng driver/passenger.
- Không tạo group chat giữa các passenger cùng trip.
- Booking active giữ contact exception dù hai bên block.
- Booking terminal + block chuyển read-only.
- Chat không tạo, sửa, accept, cancel hoặc complete booking.
- Backfill/reconciliation tạo conversation còn thiếu cho booking đã tồn tại trước cutover.

Ride event payload nội bộ cần tối thiểu `bookingId`, `tripId`, `driverId`, `passengerId`, `status`,
`version`, `occurredAt`; tuyệt đối không chứa boarding code hoặc tọa độ.

## 6. Public REST và realtime contract

| Method | Endpoint                                | Chức năng                              |
| ------ | --------------------------------------- | -------------------------------------- |
| POST   | `/api/v1/realtime/tickets`              | Tạo ticket 30 giây, một lần            |
| GET    | `/api/v1/conversations`                 | Inbox cursor pagination                |
| POST   | `/api/v1/conversations/direct`          | Tạo/lấy direct conversation cho friend |
| GET    | `/api/v1/conversations/{id}`            | Chi tiết và policy live                |
| GET    | `/api/v1/conversations/{id}/messages`   | Lịch sử theo cursor                    |
| POST   | `/api/v1/conversations/{id}/messages`   | Gửi message idempotent                 |
| PUT    | `/api/v1/conversations/{id}/read`       | Mark read tới message hợp lệ           |
| GET    | `/api/v1/message-requests`              | Incoming/outgoing requests             |
| POST   | `/api/v1/message-requests`              | Gửi opening message                    |
| POST   | `/api/v1/message-requests/{id}/accept`  | Accept                                 |
| POST   | `/api/v1/message-requests/{id}/decline` | Decline + cooldown                     |
| GET    | `/api/v1/notifications`                 | Notification cursor page               |
| GET    | `/api/v1/notifications/unread-count`    | Badge authoritative                    |
| PUT    | `/api/v1/notifications/{id}/read`       | Mark one read                          |
| POST   | `/api/v1/notifications/read-all`        | Mark tới server cutoff                 |

Message cursor encode/ký `(conversationId, sequence)`. Page query message cũ hơn cursor, response
items theo thời gian tăng dần; limit mặc định 30, tối đa 100.

`RealtimeEnvelope` tối thiểu:

```json
{
  "eventId": "...",
  "type": "message.created",
  "occurredAt": "...",
  "resourceType": "CONVERSATION",
  "resourceId": "...",
  "revision": 12,
  "payload": {}
}
```

Error codes ổn định:

- `CONVERSATION_NOT_FOUND`, `CONVERSATION_READ_ONLY`.
- `MESSAGE_INVALID`, `MESSAGE_RATE_LIMITED`.
- `MESSAGE_REQUEST_NOT_ALLOWED`, `MESSAGE_REQUEST_PENDING`, `MESSAGE_REQUEST_COOLDOWN`.
- `IDEMPOTENCY_CONFLICT`.
- `REALTIME_TICKET_INVALID`, `REALTIME_TICKET_EXPIRED`.
- `SUBSCRIPTION_FORBIDDEN`.

Rate limit mặc định, cấu hình được: 30 message/phút/conversation, 120/giờ/user; 5 message
request/giờ/user; 20 ticket/phút/session. `429` luôn có `Retry-After`.

## 7. Event và notification matrix

Tạo in-app notification cho:

- Friendship request/accepted/declined.
- Message request/accepted/declined.
- New message.
- Proposal created/rejected/expired.
- Booking confirmed/status changed/cancelled.
- Trip cancelled.
- Payment acknowledgement cần đối ứng ở Stage 14.
- Review eligibility/reminder/published ở Stage 14.
- Account/moderation action cần thông báo an toàn.

Không tự gửi notification cho actor. Dedupe bằng `(sourceEventId, recipientId, type)`. Event thay
đổi quyền chỉ mang ID/revision để client refetch, không đính kèm dữ liệu đã bị thu hồi.

## 8. Web implementation

Màn hình:

- `/messages`
- `/messages/requests`
- `/messages/[conversationId]`
- Notification drawer/page và badge trong app shell.

Yêu cầu:

- REST qua generated client; chỉ một realtime client quản lý STOMP.
- Không lưu ticket/session credential trong local/session storage.
- Optimistic message dùng `clientMessageId`; retry giữ nguyên ID.
- Dedupe optimistic, REST và STOMP bằng message/event ID.
- Reconnect: kiểm tra session → lấy ticket mới → connect/subscribe → refetch REST.
- `401` đóng socket, xóa sensitive query cache và về login.
- `CONVERSATION_READ_ONLY` giữ history nhưng khóa composer.
- Có loading, empty, offline, retry, keyboard/focus/screen-reader và responsive states.

## 9. Work breakdown

| ID     | Deliverable                        | Hoàn thành khi                                      |
| ------ | ---------------------------------- | --------------------------------------------------- |
| S12-00 | Preflight, plan, ADR, master sync  | Không còn contract realtime mâu thuẫn               |
| S12-01 | Outbox fan-out + delivery receipt  | Nhiều consumer retry độc lập, không lặp side effect |
| S12-02 | Redis Pub/Sub + envelope           | Worker/API tách process vẫn phát realtime           |
| S12-03 | Ticket + STOMP security            | Ticket single-use, origin/subscription deny đúng    |
| S12-04 | Conversation/message/request model | Unique pair/booking/client ID được DB bảo vệ        |
| S12-05 | Direct policy                      | Stranger/friend/unfriend/block/privacy đúng         |
| S12-06 | Booking chat + backfill            | Mỗi booking đúng một chat, replay không trùng       |
| S12-07 | Notification + fake delivery       | In-app bền vững, external failure không rollback    |
| S12-08 | OpenAPI/client                     | Web không tự định nghĩa DTO/backend URL             |
| S12-09 | Web UI                             | Multi-user chat/request/notification chạy qua UI    |
| S12-10 | Security/E2E/load                  | Reconnect, unread, IDOR, 100 socket đạt             |
| S12-11 | Metrics/runbook/rollout            | Có evidence, kill switch và recovery                |

## 10. Test matrix và acceptance

### Domain/concurrency

- Cùng `clientMessageId`/body tạo đúng một message; khác body bị conflict.
- Send và mark-read đồng thời không mất unread.
- Hai request cùng cặp không tạo duplicate conversation/request.
- Accept/decline/friendship/block race cho state xác định.
- Replay booking event không tạo chat/notification trùng.

### Security

- Outsider không đọc REST, subscribe room hoặc nhận user queue người khác.
- Block ngăn direct send ngay cả với socket đang mở.
- Booking exception chỉ áp dụng đúng participant và booking active.
- Ticket sai/hết hạn/reuse/authorization-version cũ bị đóng.
- Ticket, cookie, message body external, token không xuất hiện trong log/artifact.
- Worker profile không mở `/ws`; API profile không chạy business scheduler.

### Resilience/E2E

- API/worker restart không mất message/notification.
- Redis Pub/Sub mất event vẫn phục hồi qua REST reconciliation.
- Hai browser và nhiều tab giữ unread đúng.
- Reconnect burst không lặp message.
- 100 WebSocket connections theo pilot workload, báo p50/p95/error/reconnect.

### Gate cuối

- `pnpm check`, `pnpm api:check`, `mvnw verify` xanh.
- Mongo/Redis integration, STOMP security và Playwright multi-user xanh.
- OpenAPI/generated client đồng bộ.
- ADR/runbook/metrics/rollback và evidence gắn commit SHA.
- Không có secret, PII hoặc credential trong source/log/test artifact.
