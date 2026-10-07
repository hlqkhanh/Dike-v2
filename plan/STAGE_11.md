# STAGE 11 — Proposal và booking

Ngày lập: 07/10/2026. Baseline: `4ccb525` trên `main`.
Trạng thái: Đã có triển khai nền và tích hợp, chưa đóng toàn bộ gate nghiệm thu. Master plan/ADR Accepted là nguồn ưu tiên.
Phụ thuộc [Stage 9](STAGE_9.md), [Stage 10](STAGE_10.md); không tạo booking bằng chat.

Bằng chứng và phần còn lại: [runbook Stage 9–11](../docs/runbooks/posts-trips-bookings.md).

## 1. Mục tiêu, scope và điều kiện đầu vào

Hai chiều đề nghị đều kết thúc bằng đúng một lần chấp nhận của người nhận;
booking/chỗ/lịch bận/snapshot được commit nguyên tử. Cung cấp mã lên xe, arrival,
boarding, start, complete, cancel/no-show/early end và hoàn chỗ đúng một lần.
Nguồn: master 6.2–6.4, 8.1–8.2, 9.1, 11.5–11.8, Giai đoạn 11.

| Gate   | Evidence cần có                                                           |
| ------ | ------------------------------------------------------------------------- |
| G11-01 | Stage 3/5: account/verification/vehicle/membership có public policy       |
| G11-02 | Stage 6: block/friend policy và phân biệt social với booking rights       |
| G11-03 | Stage 7: intent snapshot/version, một booking hiệu lực mỗi nhu cầu        |
| G11-04 | Stage 8: authoritative quote/route/ETA/expiry và deterministic fake test  |
| G11-05 | Stage 9: post versions, edit/close/matched và visibility                  |
| G11-06 | Stage 10: seat primitive, guards, committed route/stops, driver intervals |
| G11-07 | Mongo replica set, transaction retry, receipts, outbox và clock           |

Không làm chat transport/notification UI Stage 12, GPS Stage 13, payment
acknowledgement/review Stage 14 hoặc dispute adjudication. Ghi event contract
để các stage này tích hợp; không coi event đã ghi là thông báo đã đến người dùng.
Proposal 60 giây có rule/model test, chỉ enable instant flow khi Stage 13 có
presence gate; scheduled proposal là luồng chính Stage 11.

## 2. Invariant và quyết định trước code

- Proposal không giữ chỗ. Mỗi cặp intent–trip có tối đa một PENDING.
- Passenger chỉ chủ động gửi một PENDING cho mỗi intent; vẫn nhận nhiều driver offers.
- Sender đã đồng ý điều kiện, chỉ recipient accept. Driver offer được passenger
  accept tạo booking ngay, không thêm vòng driver approve.
- Mỗi intent có tối đa một booking hiệu lực, một passenger/booking/một chỗ.
- Accept không thay giá; quote/terms không còn hợp lệ phải gửi lại.
- Booking không có PENDING. Hạn scheduled là min(created+24h, latest valid departure);
  instant min(created+60s, latest valid departure), dùng clock server.
- Passenger interval pickup→dropoff+15 phút; driver kiểm cả trip, nhiều chuyến
  tương lai được phép nếu không trùng. Block không tự hủy booking đã nhận.

| Cần chốt                           | Đề xuất                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Booking active uniqueness          | CONFIRMED/DRIVER_ARRIVED/BOARDED/IN_PROGRESS giữ khóa intent                           |
| Pending invalidation               | EXPIRED với reason TERMS_CHANGED/INTENT_BOOKED/TRIP_CLOSED; giữ terminal history       |
| Replay accept sau booking terminal | Trả cùng booking ID và projection hiện tại, không tạo booking mới                      |
| Boarding code                      | 6 số CSPRNG; chỉ passenger đọc, hash để verify, ciphertext để hiển thị lại             |
| Code limits                        | 5 lần sai/booking/15 phút, rate limit driver/IP; không reset qua nhiều session         |
| Retry receipt                      | Đề xuất 30 ngày; unique proposalId trên booking giữ invariant sau receipt hết hạn      |
| “Tìm lại”                          | Explicit command tạo draft từ snapshot phù hợp, kiểm lại intent/version; không tự OPEN |

Các con số code/rate/retention là đề xuất cần security review; 7 ngày review và
rule tiền thuộc master, không dùng retention receipt để quyết định retention booking.

## 3. Dữ liệu và ownership

`ride` sở hữu proposal/booking/availability/quote đã chốt và toàn bộ transaction
accept. `planning` giữ Post repository nhưng cung cấp public application API có
thể tham gia cùng transaction Mongo. Không đẩy post invariant sang event async.

| Dữ liệu           | Trường chủ yếu                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| RideProposal      | id, intentId, tripId, sender/recipient, direction, status/reason, expiresAt, version, terms fingerprint                               |
| Proposal snapshot | post/intent/trip/route/quote versions, pickup/dropoff refs, ETA/window, priceVnd, contribution config version                         |
| Booking           | id, proposalId, intentId, tripId, passenger/driver, status/version, immutable agreed terms, timestamps, cancellation/early-end reason |
| Boarding secret   | bookingId, salted/keyed hash, encrypted code, keyVersion, attempts window, consumedAt; không trong DTO chung                          |
| Availability/seat | Reservation IDs và release evidence liên kết booking, dùng primitives Stage 10                                                        |
| Command receipt   | actor/action/key, requestHash, result resource ID, status/expiry                                                                      |

Unique indexes: booking.proposalId; partial unique intentId cho active booking;
partial unique (intentId,tripId) cho PENDING proposal; partial unique intentId
cho PENDING direction PASSENGER_REQUEST. Index recipient/status/expiresAt/id,
tripId/status, intentId/status và booking participant/time. Stale pending có thể
vẫn chiếm index: command phải expire đúng record bằng server time trong transaction
trước tạo mới, không phụ thuộc worker đã chạy.

Snapshot giá dùng integer VND; điểm riêng tư chỉ trong projection participant.
Không nhúng danh sách messages/events không giới hạn vào booking. Migration
không tự ghép/deduplicate booking khi thấy vi phạm unique invariant.

## 4. Luồng gửi đề nghị

Passenger: chọn OFFER → pickup/dropoff → server route/quote → xác nhận snapshot
→ PENDING → driver accept. Driver: chọn NEED → chọn/tạo Trip → xem route impact/
giờ đón/giá → xác nhận → PENDING → passenger accept.

Trước tạo: kiểm owner của intent/trip, eligibility, visibility, block, loại đối
ứng, không self-ride, thời gian, trip OPEN và quote hợp lệ. Sender/recipient suy
ra từ tài nguyên, không tin body. Mỗi thao tác ghi receipt/outbox atomic.
Unique index giải quyết race hai lời mời; gửi ngược chiều không tự accept.
UI hiển thị lời mời hiện có và yêu cầu recipient quyết định rõ ràng.

## 5. Accept transaction và tránh write skew

Trước transaction, lấy candidate route insertion từ Goong bằng snapshot versions;
không external I/O trong transaction. Candidate mới không được tự thay quote
hoặc điều kiện đã đồng ý. Nếu routing làm thay terms thì expire/requote.

Trong một transaction Mongo:

1. Đọc receipt và proposal; xác thực recipient, PENDING và `now < expiresAt`.
2. Đọc account/verification/membership/block và source resource hiện hành qua
   public APIs; kiểm versions/visibility/ownership/quote/deadline/route fingerprint.
3. Ghi guards của driver/passenger và intent để serialize competing accepts;
   query lại overlap. Có interval driver của chính trip thì kiểm tương thích,
   không coi nó là conflict với chính mình hoặc bỏ qua các trip khác.
4. Conditional reserve một chỗ theo trip version/status/counter; cập nhật route
   và stop đã cam kết, kiểm detour gốc và deadline mọi khách.
5. Insert booking với unique proposalId và active intent; lưu agreed snapshot,
   boarding secret và passenger availability.
6. Proposal → ACCEPTED; NEED → MATCHED, offer phản ánh FULL; expire các proposal
   PENDING xung đột trên cùng intent và proposal có terms đã lỗi thời.
7. Ghi receipt và outbox trong cùng transaction, commit rồi trả booking.

Mọi lỗi giữa bước 3–7 rollback toàn bộ. Retry transient chạy lại cả validation;
không retry lỗi domain như NO_SEATS hoặc EXPIRED. Unknown commit result giải quyết
bằng receipt/unique booking, không trừ thêm ghế. Routing stale phải thoát transaction
và tính lại có giới hạn, không lặp provider vô hạn.

Account/block/membership revoke đồng thời cần một thứ tự quyết định rõ ràng:
chỉ đọc policy trong snapshot transaction không đủ ngăn write skew. S11-00 phải
chốt authorization fence/version được cả revoke và accept ghi/CAS qua public
module API. Thay đổi account, pair block và membership liên quan phải tranh cùng
guard; nếu revoke commit trước thì accept retry và deny. Nếu accept commit trước,
booking được giữ theo ngoại lệ nghiệp vụ. Không dùng Redis cache làm fence.

Edit terms/close trip/post và accept cũng tranh version/guard cùng transaction;
không chỉ đợi worker expire proposal. Dùng stable guard order để giảm conflict;
giới hạn pending để transaction invalidation không tăng vô hạn, hoặc dùng intent
generation fence làm pending cũ vô hiệu ngay rồi cleanup async có kiểm chứng.

## 6. Lifecycle booking và hoàn chỗ

| Command           | Actor / transition / invariant                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Reject/withdraw   | Recipient reject, sender withdraw; chỉ PENDING; không động vào ghế                                  |
| Arrive            | Driver của booking: CONFIRMED → DRIVER_ARRIVED                                                      |
| Board             | Driver nhập mã do passenger đưa; CONFIRMED/DRIVER_ARRIVED → BOARDED                                 |
| Start trip        | Driver: trip OPEN/FULL → IN_PROGRESS; booking đã BOARDED → IN_PROGRESS, đóng nhận mới               |
| Pickup trên đường | Booking đã nhận từ trước vẫn được arrive/board; nếu trip đang chạy thì vào IN_PROGRESS atomically   |
| Dropoff           | Driver ghi nhận riêng mỗi người: IN_PROGRESS → COMPLETED                                            |
| Complete trip     | Mọi người từng boarded đã terminal; xử lý người chưa lên bằng cancel/no-show đúng rule              |
| Cancel booking    | Participant trước boarding, có reason; giải phóng interval và ghế đúng một lần                      |
| No-show           | Driver, chưa boarded, server >= pickupAt+10 phút, reason và đường phản ánh                          |
| End early         | Sau boarded; không chuyển CANCELLED; lưu actor/reason/time và kết thúc interval phù hợp             |
| Cancel trip       | Hủy các booking chưa boarded, expire pending; có người boarded phải quy trình early-end có ghi nhận |

Các action actor nhạy cảm như early-end của passenger/driver cần chốt matrix
trong S11-00. Không cho một bên tự sửa timestamps/price hoặc xóa evidence.
No-show không sinh phạt tự động. Confirmed passenger trên chuyến đang chạy vẫn
giữ stop được nhận; “start” không bỏ các điểm đón chưa tới.

Hoàn chỗ dựa trên booking transition CAS + release marker trong cùng transaction.
Chỉ mở offer lại trước start, trip còn mở và offer trước đó AUTO_FULL. Sau start
không tái bán đoạn. Hủy booking không tự OPEN nhu cầu cũ; Tìm lại là thao tác riêng.

## 7. Boarding code, quyền và event

Không log/code vào outbox, list endpoint, driver response, analytics hoặc URL.
Passenger được đọc code qua endpoint riêng có `no-store`, account/booking policy.
Driver chỉ gửi code verify; compare constant-time, atomic attempts, single-use.
Encrypt bằng key môi trường có version, hash với secret riêng; mất key không
fallback plaintext. Chốt reset/support protocol trước staging, không bypass
boarding bằng admin chỉnh DB. Code consumed hoặc booking terminal không dùng lại.

Participant được đọc phần cần thiết của booking dù block; stranger kể cả friend
không được xem. DIRECT bị block khác BOOKING contact; Stage 12 giữ liên hệ active
booking, terminal chỉ đọc khi blocked. API booking không cấp social profile quyền mới.

Events đề xuất: proposal.created/expired, booking.confirmed/cancelled/boarded/
completed/no_show/ended_early, trip.started/completed. Versioned payload tối thiểu,
idempotent consumers; Stage 12 tạo conversation unique bookingId và notification
bền vững. Stage 14 chỉ nhận eligibility review khi completed đúng rule, không
gắn receipt tiền thành điều kiện hoàn tất.

## 8. API và UI đề xuất

Tất cả dưới `/api/v1`, same-origin/session/CSRF, ID từ principal/resource;
mutation Idempotency-Key, expectedVersion và typed body, không `setStatus`.

| API                                                      | Chức năng                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| POST /ride-proposals                                     | intentId/tripId/quoteId/source versions; direction suy từ actor |
| GET /ride-proposals                                      | Incoming/outgoing, cursor, DTO theo participant                 |
| POST /ride-proposals/{id}/accept                         | Transaction mục 5, trả booking ID ổn định                       |
| POST /ride-proposals/{id}/reject hoặc /withdraw          | Chỉ đúng actor, không reserve/release                           |
| GET /bookings và /bookings/{id}                          | Lịch sử/chi tiết participant                                    |
| GET /bookings/{id}/boarding-code                         | Chỉ passenger, no-store                                         |
| POST /bookings/{id}/arrive hoặc /board                   | Driver, board body có code                                      |
| POST /bookings/{id}/cancel hoặc /no-show hoặc /end-early | Reason + version, role/state/time policy                        |
| POST /bookings/{id}/complete                             | Ghi nhận dropoff riêng từng khách                               |
| POST /trips/{id}/start hoặc /complete                    | Driver và toàn bộ stop/booking invariant                        |
| POST /bookings/{id}/find-again                           | Tạo draft phù hợp sau cancel, không tự publish                  |

Lỗi: NO_SEATS, PROPOSAL_EXPIRED, TERMS_CHANGED, AVAILABILITY_CONFLICT,
BOOKING_ALREADY_EXISTS, NOT_RECIPIENT, BOARDING_CODE_INVALID/RATE_LIMITED,
NO_SHOW_TOO_EARLY. Dùng 404 che resource trái quyền, 409 state/version, 429
Retry-After; response không lộ lịch bận của người khác hoặc code đúng gần giống.

Web: inbox/outbox đề nghị, bản tóm tắt giá/đón/xuống/hạn trước confirm; server
countdown không là quyết định cuối. Double-click/retry dùng cùng key. Booking
detail theo role; code chỉ passenger, driver nhập riêng; dialog hủy vs early-end
giải thích hậu quả; lỗi ghế cuối mời tìm lại, không thông báo thành công optimistic.

## 9. Backlog và thứ tự PR

| ID     | Đầu ra                                                     | Phụ thuộc          | Acceptance                                 |
| ------ | ---------------------------------------------------------- | ------------------ | ------------------------------------------ |
| S11-00 | Gate audit, lifecycle matrix, fence/retention/security ADR | G11-01–07          | Không còn actor/state rule mơ hồ           |
| S11-01 | Proposal/Booking/snapshot/index/migration                  | S11-00             | Unique active/pending constraints          |
| S11-02 | Hai chiều create/reject/withdraw/expire                    | S11-01             | Sender không accept, không reserve sớm     |
| S11-03 | Route/quote preflight và terms checks                      | S11-02, Stage 8/10 | Không thay giá khi accept                  |
| S11-04 | Accept coordinator + guards/fences + receipts              | S11-03             | Seat/booking/post/outbox atomic            |
| S11-05 | Cancel/release/find-again                                  | S11-04             | Double cancel không tăng ghế hai lần       |
| S11-06 | Code/arrival/boarding/start/dropoff/complete               | S11-04             | Quyền/code/time/state đầy đủ               |
| S11-07 | No-show/early-end/trip cancel                              | S11-05–06          | Không CANCELLED sau boarded, không bỏ stop |
| S11-08 | OpenAPI/generated client và web                            | S11-02–07          | E2E hai role, stale/expiry/no-seats        |
| S11-09 | Outbox consumers contract/reconciliation/runbook           | S11-04–07          | Replay không trùng booking/chat contract   |
| S11-10 | Race/fault/security/load và staging evidence               | S11-08–09          | Không skip gate, rollback đã thử           |

## 10. Test matrix và DoD

| Nhóm         | Ca bắt buộc                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Pending      | Hai sends/cùng pair; hai passenger requests/cùng intent; reverse send không auto-accept          |
| Last seat    | 2 và 20 accepts tranh chỗ; đúng capacity booking, không counter âm                               |
| One intent   | Hai driver offers cho cùng nhu cầu được accept đồng thời: chỉ một booking hiệu lực               |
| Overlap      | Hai intent khác nhau cùng passenger/trip khác; driver nhiều trip; guard ngăn write skew          |
| Terms/policy | Edit/close/block/revoke membership/vehicle vs accept; kiểm thứ tự commit và fence                |
| Time         | Đúng expiry instant, 24h/60s, pickup+10m, buffer 15m, reconnect clock skew                       |
| Failure      | Crash sau reserve, sau booking trước outbox, unknown commit; retry không giữ thêm ghế            |
| Lifecycle    | Boarding sau trip start cho khách đã nhận; dropoff riêng; cancel vs board; early-end vs complete |
| Code         | Brute force nhiều session, concurrent verify, reuse, wrong actor, log/outbox không chứa secret   |
| UI/access    | Direct URL/IDOR, participant sau block, nonparticipant friend, no optimistic booking success     |
| Recovery     | Worker down/replay/out-of-order, expiry on read, reconcile phát hiện counter lệch                |

Race tests dùng Mongo replica set thật với barrier, assert DB và outbox sau
commit/rollback, không dùng mock để chứng minh atomicity. Cross-module transaction
test chứng minh Post API tham gia cùng session; không có REQUIRES_NEW phá nguyên tử.
Web E2E intercepted contract và smoke API thật được ghi tách biệt.

Metrics: accept latency/conflict/no-seats, expired/terms-changed, transaction
retry, boarding failures, release duplicates, invariant violations, outbox lag.
Log không chứa boarding code/tọa độ/phone; audit actor/action/reason/reference.
Reconciliation báo seat/booking/interval mismatches, không tự sửa business state.

Rollout theo nhóm pilot với migration đã kiểm unique constraints, kill switch
cho proposal/accept mới; giữ read/cancel/contact phục vụ chuyến đang hoạt động.
Rollback chỉ về binary hiểu booking snapshot/fence hiện tại; không xóa receipt
hoặc release evidence. Provider lỗi không đổi quote hoặc tạo booking “tạm”.

DoD: các S11 đạt; unit/module/contract/HTTP/replica-set/E2E và full CI đạt;
last-seat/one-intent/overlap/revoke race có evidence; manual staging hai role
thực hiện trọn luồng; runbook/rollback và kết quả gắn commit SHA. Bàn giao event
cho Stage 12/13/14, ghi rõ transport/GPS/payment/review chưa thuộc nghiệm thu này.
