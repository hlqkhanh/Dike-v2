# STAGE 14 — Chi phí, đánh giá và kiểm duyệt

Ngày lập: 07/10/2026. Baseline: `8a902f6` trên `main`.
Trạng thái: Đặc tả chuyên sâu thuộc batch hợp nhất Stage 12–14; không triển khai/nghiệm thu độc lập.

Runbook thực thi chính: [STAGE_12_13_14.md](STAGE_12_13_14.md). Đọc cùng
[PLAN_MASTER](PLAN_MASTER.md), [Stage 11](STAGE_11.md) và [Stage 12](STAGE_12.md).

## 1. Mục tiêu, phạm vi và gate

Stage 14 hoàn thiện khoản đóng góp ngoài nền tảng, review hai chiều và quy trình moderation có audit.
Dike không thu tiền và không tuyên bố xác minh giao dịch ngân hàng.

### Trong phạm vi

- Hiển thị amount đã chốt trong booking.
- Passenger đánh dấu “đã trả”, driver đánh dấu “đã nhận”.
- Review hai chiều cho đúng booking `COMPLETED`.
- Công bố review khi cả hai gửi hoặc hết 7 ngày.
- Rating tách DRIVER/PASSENGER và chỉ tính review published/visible.
- Report user/post/message/trip/review và payment disagreement.
- Dashboard moderation đầy đủ, content hide/restore, account lock/unlock và audit.
- Locked-account safety mode để chuyến đang có người trên xe không biến mất.

### Ngoài phạm vi

- Ví, cổng thanh toán, thu hộ, platform fee, refund hoặc bank reconciliation.
- Admin kết luận tiền đã chuyển chỉ từ acknowledgement.
- Sửa review sau submit hoặc review cho cancelled/no-show/ended-early.
- Automated punishment/moderation và emergency response.
- eKYC/document review đang hoãn; không thu giấy tờ thật qua Stage 14.

### Gate đầu vào

| Gate   | Yêu cầu                                                               |
| ------ | --------------------------------------------------------------------- |
| G14-01 | Stage 11 booking lifecycle/price snapshot/completion authoritative    |
| G14-02 | Stage 12 outbox fan-out, notification và realtime event delivery xanh |
| G14-03 | Stage 6 block/profile privacy và Stage 3 roles authoritative          |
| G14-04 | Existing Stage 9 post report được audit/migrate tương thích           |
| G14-05 | Worker clock/retry/reconciliation và Mongo transaction hoạt động      |

## 2. Quyết định đã khóa

- Payment acknowledgement là hai tuyên bố độc lập, `bankVerified=false`.
- Một bên được rút acknowledgement khi phía kia chưa xác nhận.
- Khi đủ hai bên, record khóa; không user nào tự rút.
- Không auto-confirm, không chặn completion/review và không tự phạt do thiếu acknowledgement.
- Review immutable; cửa sổ submit 7 ngày tính từ `Booking.completedAt` bằng server clock.
- Công bố ngay khi cả hai submit hoặc worker công bố review hiện có tại deadline.
- Reviewer hiển thị theo quyền profile; khi không được xem thì trả “Thành viên Dike” và không user ID.
- Moderator xử lý report/content; chỉ Admin lock/unlock, assign người khác và xem audit nhạy cảm.
- Full admin dashboard có filter, evidence, timeline, safe bulk assignment/priority.
- Account lock chặn hoạt động mới nhưng giữ safety obligations của booking hiện hữu.

Tạo ADR review publication/rating/moderation và account-lock safety matrix.

## 3. Payment acknowledgement

`ride` sở hữu `PaymentAcknowledgement`:

```text
bookingId
passengerId
driverId
amountVnd
passengerPaidAt
driverReceivedAt
lockedAt
version
```

Unique `bookingId`; migration `V014_0__payment_acknowledgements`.

Amount copy từ `Booking.agreedTerms.priceVnd` ở server. Client không gửi hoặc sửa amount. Projection:

```text
NONE
PASSENGER_REPORTED_PAID
DRIVER_REPORTED_RECEIVED
BOTH_CONFIRMED
```

Quy tắc:

- Chỉ đúng passenger được set/clear `passengerPaidAt`.
- Chỉ đúng driver được set/clear `driverReceivedAt`.
- Có thể xác nhận từ booking `CONFIRMED`; completion không phụ thuộc record này.
- PUT lặp với cùng idempotency key trả cùng result.
- Một acknowledgement tạo notification cho phía còn lại đúng một lần.
- Nếu counterpart chưa xác nhận, actor được DELETE acknowledgement của mình.
- Khi counterpart tồn tại, set `lockedAt` và DELETE trả `PAYMENT_ACK_LOCKED`.
- Race retract/confirm dùng Mongo transaction, expected version và stable lock order:
  - Confirm commit trước → retract conflict.
  - Retract commit trước → counterpart có thể còn acknowledgement đơn phía.
- Không tự chuyển từ một phía sang hai phía theo thời gian.
- Payment disagreement tạo report; moderation không sửa acknowledgement thay user.

REST:

| Method | Endpoint                                                 |
| ------ | -------------------------------------------------------- |
| GET    | `/api/v1/bookings/{id}/payment-acknowledgement`          |
| PUT    | `/api/v1/bookings/{id}/payment-acknowledgement/paid`     |
| DELETE | `/api/v1/bookings/{id}/payment-acknowledgement/paid`     |
| PUT    | `/api/v1/bookings/{id}/payment-acknowledgement/received` |
| DELETE | `/api/v1/bookings/{id}/payment-acknowledgement/received` |

Response luôn có `amountVnd`, hai timestamp, projection status, `locked`, `bankVerified=false` và
version; không chứa thông tin ngân hàng.

## 4. Review domain và eligibility

`trust` sở hữu Review:

```text
id
bookingId
reviewerId
revieweeId
revieweeRole: DRIVER | PASSENGER
stars
comment
submittedAt
publishDeadline
publicationStatus: PENDING | PUBLISHED
publishedAt
moderationStatus: VISIBLE | HIDDEN
moderatedAt
moderatedBy
moderationReason
version
```

Indexes:

- Unique `(bookingId, reviewerId)`.
- `(revieweeId, revieweeRole, publicationStatus, moderationStatus, id)`.
- `(publicationStatus, publishDeadline)`.
- `(moderationStatus, id)`.

Migration `V014_1__reviews_rating_indexes`.

Eligibility lấy qua public `ride` application port, không đọc ride repository:

- Booking phải `COMPLETED`.
- Passenger chỉ review đúng driver; driver chỉ review đúng passenger của booking.
- Không self-review hoặc review passenger khác cùng trip.
- Block/unfriend không ảnh hưởng quyền review booking hợp lệ.
- `stars` integer 1–5.
- Comment trim; blank thành null; tối đa 1.000 Unicode code point.
- Cho submit khi `serverNow < completedAt + 7 ngày`; tại đúng deadline window đóng.
- Review immutable sau insert.
- Account locked không submit trực tiếp; UI dẫn tới support/report flow.

### Publication

- Review đầu tiên lưu `PENDING`; chỉ reviewer đọc được review của mình.
- Submit review thứ hai publish cả hai trong transaction.
- Worker quét `(PENDING, publishDeadline <= now)` và conditional-publish review hiện có.
- Không có review thì không tạo record rỗng.
- Worker replay/out-of-order không publish/cộng rating hai lần.
- Mỗi published review phát `review.published`; trước publication không event/notification nào lộ
  stars/comment của phía kia.
- Review reminder tạo khi booking completed và một lần trước deadline 24 giờ nếu actor chưa submit;
  dedupe bằng booking/user/reminder type.

## 5. Rating projection

Rating tách theo vai trò của reviewee tại booking time:

```text
rating_summaries
  userId
  role: DRIVER | PASSENGER
  sumStars
  reviewCount
  average
  sourceRevision
  updatedAt
```

Unique `(userId, role)`.

- Chỉ `PUBLISHED + VISIBLE` được tính.
- Count 0 trả `average=null`, không biểu diễn 0 sao.
- DB giữ `sumStars/reviewCount`; API làm tròn average một chữ số.
- Publish/hide/restore kích hoạt recompute từ source reviews, không increment/decrement mù.
- Recompute lặp cho cùng revision không thay đổi kết quả.
- Phát `rating.updated` với user/role/average/count, không có review content.
- `identity` và `planning` giữ projection cục bộ từ event để tránh dependency cycle.
- Matching dùng driver rating cho candidate driver và passenger rating cho passenger.

Public review không trả booking/trip ID, route, pickup/drop-off hay thời điểm chuyến. Reviewer:

- Viewer được phép xem profile: current `userId`, display name và avatar.
- Không có quyền hoặc bị block/privacy deny: `userId=null`, display name “Thành viên Dike”, avatar null.
- Review hợp lệ không bị xóa do unfriend/block.

## 6. Review API

| Method | Endpoint                                   | Chức năng                                  |
| ------ | ------------------------------------------ | ------------------------------------------ |
| GET    | `/api/v1/bookings/{id}/review-eligibility` | Actor, target, deadline, submitted state   |
| POST   | `/api/v1/reviews`                          | Submit immutable review                    |
| GET    | `/api/v1/bookings/{id}/reviews`            | Own/published projection theo quyền        |
| GET    | `/api/v1/users/{id}/ratings`               | DRIVER/PASSENGER summary                   |
| GET    | `/api/v1/users/{id}/reviews`               | Published visible reviews theo role/cursor |
| GET    | `/api/v1/me/reviews`                       | Review actor đã viết/pending/published     |

Error codes:

- `REVIEW_NOT_ELIGIBLE`, `REVIEW_WINDOW_CLOSED`.
- `REVIEW_ALREADY_SUBMITTED`, `REVIEW_TARGET_INVALID`.
- `REVIEW_NOT_PUBLISHED`, `REVIEW_HIDDEN`.

## 7. Generic report model và migration

Thay adapter chỉ hỗ trợ post bằng generic `reports`:

```text
id
reporterId
targetType: USER | POST | MESSAGE | TRIP | REVIEW
targetId
contextBookingId
reason
note
status: RECEIVED | TRIAGED | IN_REVIEW | RESOLVED | DISMISSED
priority: P0 | P1 | P2 | P3
assignedTo
evidenceSnapshot
resolutionCode
resolutionNote
createdAt
updatedAt
resolvedAt
version
```

Migration `V014_2__generic_reports`:

- Tạo collection/index mới.
- Copy idempotent record từ `post_reports` thành `targetType=POST` với cùng ID/timestamp/status.
- Giữ `post_reports` read-only ít nhất một release; không drop ở Stage 14.
- `POST /reports` tiếp tục nhận legacy `postId` được đánh dấu deprecated, đồng thời hỗ trợ
  `targetType + targetId`; request phải có đúng một target form.
- Web Stage 9 chuyển sang request mới trước khi bỏ legacy.

Indexes:

- `(status, priority, createdAt, id)`.
- `(assignedTo, status, updatedAt, id)`.
- `(targetType, targetId, status)`.
- `(reporterId, createdAt desc)`.
- Unique partial open report theo `(reporterId, targetType, targetId)`.

### Target authorization

- USER: không report chính mình; target account phải tồn tại nhưng response không lộ PII.
- POST: reporter phải có/đã có lawful readable projection.
- MESSAGE: reporter là participant và chỉ report message phía kia.
- TRIP: reporter là participant hoặc có quyền xem trip tại incident.
- REVIEW: review published hoặc reporter là reviewee.
- Payment disagreement dùng target TRIP kèm `contextBookingId` mà reporter tham gia.
- Rate limit 10 report/giờ; idempotency và unique open report chống spam.

Reasons: `SPAM`, `HARASSMENT`, `UNSAFE`, `MISLEADING`, `HATEFUL_CONTENT`, `PRIVACY`,
`PAYMENT_DISAGREEMENT`, `OTHER`.

### Evidence

- Snapshot tối thiểu để content thay đổi không phá điều tra.
- Message evidence giữ text/metadata cần thiết và chỉ role được phép đọc.
- Trip evidence không chứa exact GPS.
- Không snapshot phone/email đầy đủ, token, OTP, boarding code hoặc private document.
- Đọc evidence là sensitive action và luôn ghi audit.

## 8. Moderation workflow và content action

Transitions:

```text
RECEIVED → TRIAGED → IN_REVIEW → RESOLVED
                              └→ DISMISSED
RESOLVED/DISMISSED → IN_REVIEW  // reopen với reason
```

- Default `P2`; unsafe/safety mặc định `P1` nhưng không auto-enforce.
- Moderator tự claim; Admin assign/reassign người khác.
- Mọi mutation có expected version + Idempotency-Key.
- Resolve/dismiss/reopen bắt buộc code và internal note.
- Reporter chỉ thấy receipt/status tổng quát, không thấy assignee/evidence/internal audit.
- Enforcement là command riêng, không ngầm chạy khi resolve report.

Content actions qua public port của module sở hữu:

- POST: hide/restore khỏi feed, vẫn giữ owner/admin evidence.
- MESSAGE: participant thấy placeholder; evidence không bị xóa.
- REVIEW: hide/restore và recompute rating.
- TRIP: moderation restriction ngăn proposal/booking mới; không hủy active booking.
- USER: chỉ Admin lock/unlock.

Moderator được xử lý report và hide/restore content. Chỉ Admin được lock/unlock user, assign người
khác, xem global sensitive audit và override/reopen action nhạy cảm.

## 9. Account lock safety mode

Admin lock command:

- Set `AccountStatus=LOCKED`, tăng `authorizationVersion`, reason bắt buộc.
- Phát `account.locked`; đóng current WebSocket và vô hiệu normal realtime ticket.
- Session/request tiếp theo chỉ có `LOCKED_ACCOUNT`, không còn MEMBER/VERIFIED/DRIVER/admin roles.
- Không chỉ dựa vào `.authenticated()`; thêm locked-account route filter và use-case policy.
- Locked user vẫn có thể login để xem locked page/safety obligations, nhưng là restricted session.

### Allowlist

- Xem auth/session và logout.
- Xem booking/trip mà user là participant.
- Xem/gửi booking chat khi booking active.
- Hủy trước boarding nếu lifecycle cho phép.
- Với `BOARDED/IN_PROGRESS`: booking chat, location consent/update, end-early hoặc complete đúng role.
- Đọc safety notification và gửi report/support.

### Deny

- Post/trip/proposal/booking mới hoặc accept proposal mới.
- Availability, direct chat/message request, friendship/community mutation.
- Profile/public content mutation, review submission và payment acknowledgement mới.
- Normal realtime ticket hoặc truy cập admin cũ.

Khi booking terminal, contact/location exception kết thúc. Unlock chỉ Admin, reason bắt buộc, tăng
authorization version và phát `account.unlocked`; không tự restore content đã bị hide.

## 10. Audit log

Append-only `audit_logs`:

```text
id
actorUserId
actorRole
action
targetType
targetId
reportId
reason
safeBefore
safeAfter
requestId
occurredAt
```

Migration `V014_3__moderation_audit_indexes`.

- Không public update/delete.
- Sensitive mutation và audit insert cùng transaction khi có thể.
- Idempotent retry không tạo audit trùng.
- Không lưu exact coordinate, token, OTP, document, full phone/email hoặc message body trong list.
- Evidence access có audit riêng.
- Moderator chỉ thấy audit thuộc report/content được phép; Admin xem toàn hệ thống.

## 11. Admin dashboard đầy đủ

Routes:

```text
/admin
/admin/reports
/admin/reports/[reportId]
/admin/users/[userId]
/admin/content/[type]/[id]
/admin/audit
```

Chức năng:

- Summary cards theo status, priority, target type và age bucket.
- Filter status/type/reason/priority/assignee/date.
- Search report/target/reporter ID, không search PII.
- Cursor pagination và URL-persisted filter an toàn.
- Detail evidence, target state, related reports và audit timeline.
- Self-claim; Admin assign/reassign.
- Priority, triage, in-review, resolve, dismiss, reopen.
- Hide/restore content; lock/unlock account với confirmation + reason.
- Cảnh báo safety obligations nếu user có booking active/in-progress.
- Loading/empty/error/stale-version/access-denied và accessible keyboard/focus states.

Bulk tối đa 50 report, chỉ assign và priority. Không bulk lock, hide, resolve hoặc dismiss. Mỗi item
có kết quả/audit riêng; partial failure hiển thị rõ.

Web route guard chỉ là UX; backend kiểm tra authority và target resource trên mọi request.

## 12. Admin và report API

| Method | Endpoint                                      |
| ------ | --------------------------------------------- |
| POST   | `/api/v1/reports`                             |
| GET    | `/api/v1/reports/{id}/status`                 |
| GET    | `/api/v1/admin/reports`                       |
| GET    | `/api/v1/admin/reports/{id}`                  |
| POST   | `/api/v1/admin/reports/{id}/claim`            |
| PUT    | `/api/v1/admin/reports/{id}/assignment`       |
| PUT    | `/api/v1/admin/reports/{id}/priority`         |
| POST   | `/api/v1/admin/reports/{id}/transitions`      |
| POST   | `/api/v1/admin/reports/bulk`                  |
| GET    | `/api/v1/admin/reports/{id}/evidence`         |
| POST   | `/api/v1/admin/content/{type}/{id}/hide`      |
| POST   | `/api/v1/admin/content/{type}/{id}/restore`   |
| POST   | `/api/v1/admin/users/{id}/lock`               |
| POST   | `/api/v1/admin/users/{id}/unlock`             |
| GET    | `/api/v1/admin/users/{id}/safety-obligations` |
| GET    | `/api/v1/admin/audit`                         |

Error codes:

- `PAYMENT_ACK_LOCKED`.
- `REPORT_INVALID_TARGET`, `REPORT_ALREADY_OPEN`, `REPORT_TRANSITION_INVALID`.
- `REPORT_ASSIGNMENT_FORBIDDEN`, `MODERATION_VERSION_CONFLICT`.
- `CONTENT_ALREADY_HIDDEN`.
- `ACCOUNT_ALREADY_LOCKED`, `ACCOUNT_NOT_LOCKED`, `ACCOUNT_LOCKED`.
- `SAFETY_ACTION_NOT_ALLOWED`.

## 13. Work breakdown

| ID     | Deliverable                       | Hoàn thành khi                                   |
| ------ | --------------------------------- | ------------------------------------------------ |
| S14-00 | Preflight, plan, ADR, master sync | Rule matrix payment/review/moderation khóa       |
| S14-01 | Payment model/API                 | Hai acknowledgement, amount server-owned         |
| S14-02 | Retract/lock/notification/UI      | Race deterministic, không bank claim             |
| S14-03 | Review eligibility/submission     | Chỉ đúng COMPLETED pair, unique/immutable        |
| S14-04 | Publication/reminder worker       | Both-or-7-days, replay idempotent                |
| S14-05 | Rating projections                | Role tách, hide/restore/replay không drift       |
| S14-06 | Generic report migration          | Legacy post report tương thích, target auth đúng |
| S14-07 | Workflow/content/audit            | Enforcement riêng, audit append-only             |
| S14-08 | Lock/unlock + safety mode         | Chặn hoạt động mới, giữ active obligations       |
| S14-09 | OpenAPI/client                    | Generated client và stale check xanh             |
| S14-10 | Payment/review web                | Booking → ack → two-way review qua UI            |
| S14-11 | Full admin dashboard              | Filter/evidence/action/audit theo role           |
| S14-12 | Security/concurrency/E2E          | Không leak pending review/evidence/authority     |
| S14-13 | Metrics/runbook/rollout           | Có reconciliation, kill switch và evidence       |

## 14. Test matrix

### Payment

- Mỗi actor chỉ sửa acknowledgement của mình; amount giả bị bỏ qua/từ chối.
- Một phía không tự thành confirmed; completion/review không bị block.
- Retract được khi counterpart null; bị chặn khi counterpart tồn tại.
- Concurrent retract/confirm không tạo trạng thái bất khả thi.
- Idempotent retry không lặp notification/audit.

### Review

- Không self-review, wrong booking/role/passenger hoặc non-completed booking.
- Không review cancelled/no-show/ended-early.
- Unique `(bookingId, reviewerId)` chống concurrent duplicate.
- Boundary 7 ngày theo server clock; immutable sau submit.
- Pending review phía kia không lộ qua REST, notification, count, event hoặc UI.
- Review thứ hai publish cả hai; deadline worker publish một review hiện có.
- Worker replay không nhân đôi rating; hide/restore recompute đúng.
- Driver/passenger ratings không trộn; count 0 không hiển thị 0 sao.
- Public review không có trip/booking/route/location/time.

### Reports/admin/security

- Wrong role/IDOR không đọc report, evidence hoặc audit.
- Moderator không lock/unlock, assign người khác hoặc đọc global audit.
- Report không tự enforcement; content action có reason/version/audit.
- Legacy post report copy đúng và API cũ còn tương thích.
- Message hidden vẫn có evidence; trip restriction không hủy active booking.
- Lock đóng socket và chặn mọi new activity.
- Locked participant vẫn đọc/contact/end safely theo exact allowlist.
- Terminal booking thu hồi safety exception.
- Log/artifact không chứa evidence nhạy cảm, coordinate hoặc credential.

### E2E bắt buộc

```text
login hai user
→ proposal/booking
→ booking chat
→ arrived/boarded/start/live location/complete
→ passenger “đã trả”
→ driver “đã nhận”
→ hai chiều review
→ publish và rating theo role
→ report message/review
→ moderator xử lý/hide
→ admin khóa user
→ safety obligations và audit được kiểm chứng
```

## 15. Observability, rollout và DoD

Metrics không dùng high-cardinality user/resource ID:

- Payment acknowledgement state/retract/conflict.
- Review eligible/submitted/pending/published/publication lag.
- Rating recompute/reconciliation failure.
- Open report count/age/priority và moderation action failure.
- Account lock/unlock/safety deny và audit write failure.

Feature flags:

```text
dike.trust.payment-acknowledgements.enabled
dike.trust.reviews.enabled
dike.trust.moderation.enabled
```

Kill switch chỉ chặn mutation mới; read/history/admin recovery/safety obligations vẫn hoạt động.

Gate cuối:

- Mongo transaction/concurrency/worker replay/security tests xanh.
- Playwright hoàn thành payment → two-way review → moderation → account lock.
- `pnpm check`, `pnpm api:check`, `mvnw verify` xanh.
- OpenAPI/generated client, ADR, admin/safety runbook và dependency matrix đồng bộ.
- Reconciliation chứng minh payment/review/rating/report/audit không drift.
- Không có secret, PII, exact GPS hoặc credential trong log/artifact.
- Acceptance evidence gắn commit SHA; chưa dùng dữ liệu/giấy tờ thật.
