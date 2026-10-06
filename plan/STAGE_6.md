# STAGE 6 — Bạn bè, chặn và quyền truy cập

Ngày lập: 07/10/2026. Baseline rà soát: `73d07a4` trên `main`.

Trạng thái: Đã triển khai core trên baseline mới `f8b453f`; chưa nghiệm thu đầy
đủ Stage 6. Quyết định thực tế và khác biệt so với đề xuất bên dưới nằm trong
[ADR 0014](../docs/architecture/adr/0014-social-relations-and-revocation.md),
cách kiểm tra tại [runbook](../docs/runbooks/social-relations.md). Stage 5 và
socket/các tài nguyên stage sau còn là gate bắt buộc. Master plan
và ADR Accepted có ưu tiên cao hơn tài liệu này. API, schema, hạn mức và cách
chia PR dưới đây là đề xuất cần review trước khi code.

## 1. Mục tiêu và phạm vi

Người dùng quản lý quan hệ bạn bè và danh sách chặn qua web. Backend bảo đảm
một quan hệ cho mỗi cặp người dùng, không tự kết bạn khi gửi ngược chiều và
không cấp quyền từ lời mời đang chờ. Block thắng quyền xã hội từ cả hai phía.

Trong phạm vi:

- Gửi, xem lời mời đến/đi, chấp nhận, từ chối, rút lời mời, hủy kết bạn.
- Danh sách bạn bè, chặn/bỏ chặn, cooldown, rate limit và xử lý concurrency.
- Policy quan hệ xã hội dùng chung, tích hợp profile và membership đã có.
- Thu hồi quyền khi đọc lại, cache theo người xem, sự kiện thu hồi quyền.
- REST/OpenAPI, client sinh tự động, web, audit, integration và E2E test.
- Kiểm thử policy cho lịch, bài, chat và socket; theo dõi gate tích hợp thật
  ở các stage có tài nguyên tương ứng.

Ngoài phạm vi: gợi ý bạn bằng danh bạ, tìm bằng số điện thoại, nhóm bạn, mobile UI,
xây toàn bộ lịch/feed/booking/chat, tự duyệt cộng đồng hoặc tự nâng quyền tài xế.

Nguồn yêu cầu: `PLAN_MASTER.md` mục 3.3–3.4, 5.5, 9.1, 9.4, 11.3,
11.8–11.9 và Giai đoạn 6. Bạn bè không bỏ qua membership, xác minh, giá,
số chỗ hoặc sự đồng ý tham gia chuyến.

## 2. Hiện trạng và điều kiện đầu vào

Tại baseline, `community` mới có khai báo module; chưa có friendship/block
implementation. Repo có nền identity/session, Mongo transaction/outbox và
pipeline OpenAPI. Có tài liệu Stage 0–3, chưa có runbook Stage 4–5 trong checkout.
Điều này không chứng minh Stage 3–5 đã được nghiệm thu.

Checkout đang chậm hơn remote-tracking `origin/main` 4 commit khi rà soát;
diff đó là cấu hình/security/test, không sửa master plan. Trước implementation
phải đồng bộ baseline và kiểm tra lại contract, không dựa vào tên lớp cũ.

| Gate  | Đầu vào cần có                                                       | Nếu chưa có                                              |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| G6-01 | Stage 2: session, revoke, CSRF/Origin và browser login đã nghiệm thu | Chưa mở mutation cho người dùng                          |
| G6-02 | Stage 3: principal, account status và quyền server-side              | Chỉ làm domain/test, chưa đóng stage                     |
| G6-03 | Stage 4: profile projection, privacy, account deletion contract      | Chốt port và fixture; còn nợ integration profile thật    |
| G6-04 | Stage 5: membership query và hành vi account bị khóa                 | Chốt policy cộng đồng, không mock để tuyên bố hoàn thành |
| G6-05 | Mongo replica set, unique indexes, transaction/outbox retry          | Không thay bằng Mongo standalone cho integration test    |

Không tự yêu cầu `VERIFIED_MEMBER` để kết bạn nếu master chưa quy định.
Đề xuất tài khoản active, đã đăng nhập được dùng chức năng xã hội; khóa/xóa tài
khoản ngăn tương tác mới theo policy identity. Chốt eligibility trước PR đầu.

## 3. Quyết định nghiệp vụ cần chốt

| Điểm cần làm rõ         | Mặc định đề xuất                                                                             | Tiêu chí                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Cooldown 7 ngày         | Áp dụng cho cả cặp sau DECLINED/REMOVED; đúng 168 giờ UTC từ server                          | Đổi chiều gửi không lách cooldown                        |
| Rút lời mời             | CANCELLED không thêm cooldown 7 ngày; vẫn chịu rate limit                                    | Master chỉ bắt buộc cooldown sau từ chối/hủy bạn         |
| Bỏ chặn                 | Chỉ bỏ block của chính mình; không khôi phục bạn/lời mời                                     | Nếu bên kia còn chặn, mọi quyền xã hội vẫn bị chặn       |
| Cooldown sau block      | Quan hệ ACCEPTED thành REMOVED và tính 7 ngày; PENDING thành CANCELLED, giữ cooldown cũ      | Bỏ chặn không xóa dấu vết cooldown                       |
| Tìm người               | Tái dùng tìm kiếm profile an toàn Stage 4; không trả email/phone hay duyệt toàn bộ tài khoản | Nếu chưa có, lập hạng mục profile lookup tối thiểu riêng |
| Trạng thái phía bị chặn | Lỗi chung RESOURCE_NOT_AVAILABLE, không tiết lộ ai chặn                                      | Chủ block vẫn quản lý được mục chặn của mình             |

Đây là các cách diễn giải bổ sung, không thay đổi master một cách ngầm định.
PR S6-00 phải ghi quyết định cuối và sửa test/contract tương ứng.

## 4. Ownership và thiết kế dữ liệu

`community` sở hữu friendship, block và SocialAccessPolicy. `identity` cung cấp
account eligibility/profile privacy qua public application API; `planning`,
`ride`, `messaging`, `trust` giữ quyền quyết định tài nguyên của chính module.
Không đọc repository nội bộ của module khác; `shared` chỉ giữ primitive kỹ thuật.

Đề xuất aggregate `SocialRelation` trong collection `social_relations`:

| Trường                                  | Ý nghĩa                                                             |
| --------------------------------------- | ------------------------------------------------------------------- |
| id, userLowId, userHighId               | Hai ID khác nhau, sắp xếp bằng quy tắc canonical thống nhất         |
| friendshipStatus                        | null khi chưa từng mời; PENDING/ACCEPTED/DECLINED/CANCELLED/REMOVED |
| requesterId, requestId                  | Người gửi và ID của vòng lời mời hiện tại                           |
| requestedAt, respondedAt, cooldownUntil | Timestamp UTC từ clock server                                       |
| blockedBy                               | Tập tối đa hai user ID thuộc cặp; không trả nguyên tập cho client   |
| version, createdAt, updatedAt           | Optimistic concurrency và revision thu hồi quyền                    |

Gộp friendship/block trong cùng aggregate để accept và block cùng cạnh tranh
trên một version; tránh hai collection độc lập dẫn đến accept sau block.
Chỉ trạng thái ACCEPTED và không có block mới là bạn bè hiệu lực.

Indexes bắt buộc: unique `(userLowId, userHighId)`; indexes phục vụ từng phía
theo status/updatedAt/id, requester và blockedBy. Đo explain trên truy vấn thực
trước chốt index, không thêm index chỉ vì có field. Cursor ổn định theo
`updatedAt + id`, page size mặc định 20, tối đa 50, khử trùng khi refresh.

Không TTL-xóa aggregate còn block/cooldown. Retention, xóa tài khoản và audit
phải theo Stage 4; không giữ quan hệ cá nhân vô thời hạn chỉ để chống trùng.
Migration kiểm tra duplicate trước tạo unique index, dừng có báo cáo nếu phát
hiện lỗi; không tự chọn một bản ghi rồi xóa các bản khác.

## 5. State machine, transaction và concurrency

| Command             | Điều kiện                                                           | Kết quả                                                  |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| Send                | Hai account hợp lệ, khác nhau, không block, hết cooldown            | Tạo vòng PENDING mới                                     |
| Send lại cùng chiều | Đã PENDING                                                          | Trả lời mời hiện có, không tạo event trùng               |
| Send ngược chiều    | Đã PENDING                                                          | Trả incoming invitation, yêu cầu người nhận accept riêng |
| Accept              | Actor là người nhận, đúng requestId hiện hành, PENDING, không block | ACCEPTED                                                 |
| Decline             | Actor là người nhận, đúng requestId, PENDING                        | DECLINED, cooldown +7 ngày                               |
| Cancel              | Actor là người gửi, đúng requestId, PENDING                         | CANCELLED                                                |
| Unfriend            | Actor thuộc cặp, ACCEPTED                                           | REMOVED, cooldown +7 ngày                                |
| Block               | Actor thuộc cặp, target khác mình                                   | Thêm actor vào blockedBy; kết thúc quan hệ/lời mời       |
| Unblock             | Actor đang có block                                                 | Bỏ riêng actor; không tái tạo quan hệ                    |

Send khi đã ACCEPTED trả quan hệ hiện có. Trạng thái terminal cho phép gửi mới
sau kiểm tra cooldown/block; không sửa requester của lời mời đang chờ.
Lệnh trên requestId cũ không được áp dụng cho một lời mời mới cùng cặp.

Mỗi mutation dùng transaction Mongo ghi aggregate, outbox và receipt idempotency
theo primitive hiện có. Unique pair xử lý hai lần insert đồng thời; update dùng
version/CAS. Conflict thì đọc lại và đánh giá điều kiện, retry có giới hạn;
không lặp mù một quyết định quyền đã cũ. Block luôn làm trạng thái cuối bị chặn
dù accept đã commit trước nó; accept sau block phải thất bại.

Idempotency-Key scope theo actor + command + key; khác payload cùng key trả 409. Retry không đổi timestamp cooldown, không phát thêm thông báo hoặc audit
thành công. Receipt không bỏ qua kiểm tra account/quyền hiện tại để trả dữ liệu
nhạy cảm đã mất quyền. Request thiếu điều kiện, self-action hoặc sai actor phải
thất bại trước ghi dữ liệu.

## 6. Policy truy cập chung

Public API đề xuất: `relationship(viewer, owner)` và
`evaluateSocialAccess(viewer, owner, context)`. Kết quả nội bộ gồm allow/deny,
reason và relationVersion; không expose reason nhạy cảm ra DTO công khai.
Resource module phải kiểm tra resource thật, ownership, visibility, membership
và trạng thái hiện tại; client không được tự cung cấp dữ kiện có thẩm quyền.

| Ngữ cảnh                  | Quy tắc                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Social profile / PUBLIC   | Cần login, profile projection hợp lệ, không block; PUBLIC không có nghĩa SEO public       |
| FRIENDS                   | ACCEPTED hiệu lực; PENDING không cấp quyền                                                |
| COMMUNITY                 | Membership hợp lệ trong community của tài nguyên; bạn bè không thay membership            |
| PRIVATE schedule          | Chỉ owner; bản FRIENDS vẫn bỏ địa chỉ/tọa độ riêng tư                                     |
| DIRECT chat               | Block cấm gửi hai phía; lịch sử giữ cho reporting; rule tin nhắn chờ thuộc Stage 12       |
| Sau unfriend              | Không xóa chat; chat đã mở phụ thuộc setting nhận tin từ người lạ                         |
| BOOKING đang hoạt động    | Quyền liên hệ và dữ liệu cần thiết theo booking, kể cả block; không cấp thêm quyền xã hội |
| BOOKING kết thúc          | Nếu block, chat chỉ đọc; không xóa dữ liệu nghiệp vụ cần lưu                              |
| Review booking hoàn thành | Block/unfriend không xóa review hợp lệ hoặc quyền review đã đủ điều kiện                  |

Không viết một điều kiện `blocked => deny tất cả` áp cho booking, báo cáo và
review. Các ngoại lệ phải dùng context định kiểu và evidence do module sở hữu
cung cấp, không phải cờ `ignoreBlock` nhận từ request. Admin cũng cần use case
và audit riêng, không có social-policy bypass mặc định.

## 7. Thu hồi quyền, cache và realtime

Mốc bảo đảm: sau mutation thu hồi quyền commit, request đọc mới phải kiểm tra
quan hệ có thẩm quyền và không trả nội dung đã mất quyền. Dữ liệu đã gửi về
trước commit không thể thu hồi vật lý; client phải gỡ khi nhận invalidation.

- Stage 6 ưu tiên không cache quyết định allow. Đọc quan hệ từ primary trước
  khi trả dữ liệu bảo vệ; Redis lỗi không được làm hệ thống mặc định allow.
- Cache nội dung phải tách viewer/resource/revision và vẫn chạy authorization
  trước cache hit. Không dùng outbox invalidation trễ làm hàng rào bảo mật duy nhất.
- Ghi sự kiện versioned `social.relationship.changed` trong cùng transaction;
  payload tối thiểu eventId, schemaVersion, pair IDs, relationVersion, thời gian
  và loại thay đổi; không copy profile riêng tư hoặc chi tiết lịch.
- Worker consumer idempotent, bỏ sự kiện cũ theo version, retry/backoff và cảnh
  báo backlog; invalidation bao phủ profile, bạn bè/counts, lịch, feed và search.
- Web mutation gỡ dữ liệu ảnh hưởng ngay, invalidate TanStack Query; tab khác
  nhận tín hiệu qua BroadcastChannel. Reconnect/focus tải lại REST có kiểm quyền.
- Client phía còn lại cần user event báo gỡ nội dung. Nếu transport chưa có,
  ghi gate chưa đạt thay vì coi refresh thủ công là đủ tiêu chí này.
- STOMP kiểm quyền ở SUBSCRIBE, reconnect và trước delivery cho subscription
  đang mở; revoke phải chặn phát nội dung tiếp dù client bỏ qua event thu hồi.
  Handshake hợp lệ không bảo đảm được vào mọi room.

Stage 6 làm contract và kiểm thử adapter socket hiện có; nếu chưa có broker/
destination thật, tạo integration harness tối thiểu cho interceptor và ghi nợ
E2E transport ở Stage 12. Harness không thay bằng chứng socket production.

## 8. REST và hợp đồng lỗi đề xuất

Các route dưới đây nằm dưới `/api/v1`, browser gọi qua same-origin web proxy.
Actor lấy từ principal, không lấy từ body. Giữ error envelope/CSRF hiện có.

| Method / route                                         | Mục đích                                                  |
| ------------------------------------------------------ | --------------------------------------------------------- |
| GET /friendships?status=ACCEPTED                       | Bạn bè của actor, cursor pagination                       |
| GET /friendships/requests?direction=incoming\|outgoing | Lời mời đang chờ của actor                                |
| POST /friendships/requests                             | Body targetUserId; gửi hoặc trả lời mời đã có             |
| POST /friendships/requests/{requestId}/accept          | Người nhận chấp nhận                                      |
| POST /friendships/requests/{requestId}/decline         | Người nhận từ chối                                        |
| POST /friendships/requests/{requestId}/cancel          | Người gửi rút                                             |
| DELETE /friendships/{otherUserId}                      | Hủy quan hệ với actor                                     |
| GET /blocks                                            | Chỉ danh sách do actor chặn; projection quản lý tối thiểu |
| PUT /blocks/{targetUserId}                             | Chặn idempotent                                           |
| DELETE /blocks/{targetUserId}                          | Bỏ block của actor, idempotent                            |

Response chỉ gồm trạng thái được phép biết, requestId, allowedActions,
cooldownUntil nếu hợp lệ và version. Không trả blockedBy hoặc danh sách bạn của
người khác qua các route này. Profile dùng projection riêng của Stage 4.

Mã lỗi: 401 chưa đăng nhập; 403 account không đủ điều kiện/CSRF; 404 tài nguyên
không tồn tại hoặc không được biết; 409 transition/version/idempotency conflict;
422 input không hợp lệ; 429 hạn mức kèm Retry-After. Cooldown dùng 409 với
code `FRIENDSHIP_COOLDOWN` và retryAt. Không phân biệt account tồn tại/bị chặn
cho request dò ID. OpenAPI mô tả cả lỗi và generate client, không viết enum TS tay.

## 9. Web và chống làm phiền

Màn Bạn bè gồm Bạn bè, Lời mời đến, Đã gửi và lối vào Danh sách chặn trong
settings. Profile có action dựa trên response server. Có empty/loading/error,
keyboard navigation, pending chống double-click và rollback lỗi rõ ràng.

Dialog hủy bạn giải thích mất quyền nội dung FRIENDS; dialog chặn giải thích
ngoại lệ liên hệ booking đang hoạt động. Bỏ chặn không ghi “khôi phục bạn bè”.
Hiển thị thời điểm gửi lại từ server; đồng hồ client không quyết định quyền.
Không optimistic-render thông tin private trước khi server cho phép.

Hạn mức đề xuất để review: gửi mới 10/giờ và 30/ngày/account, tối đa 100 lời
mời outgoing đang chờ; search 30/phút/account. Kết hợp session/account và IP
có xét mạng trường/công ty chung. Rate limit phân tán bằng Redis, atomic counter;
giới hạn pending phải an toàn khi nhiều target đồng thời, dùng quota reservation
bền vững hoặc cơ chế tương đương, không chỉ count rồi insert.

Khi limiter lỗi, tạm từ chối gửi mới/search có thông báo retry; vẫn ưu tiên cho
phép block, unfriend và withdraw đã xác thực. Endpoint revoke vẫn có giới hạn
tải tổng thể nhưng không dùng chung quota gửi lời mời. Không làm chậm thao tác
tự bảo vệ vì user đã dùng hết hạn mức mời.

## 10. Work breakdown và thứ tự PR

| ID    | Công việc / đầu ra                                                   | Phụ thuộc           | Điều kiện nghiệm thu                                               |
| ----- | -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------ |
| S6-00 | Đồng bộ baseline, kiểm gate 3–5, chốt mục 3 và policy matrix         | G6-01–05            | Decision log, không còn rule mâu thuẫn master                      |
| S6-01 | Aggregate, canonical pair, clock và state-machine unit tests         | S6-00               | Đủ transition, cooldown boundary, no self-action                   |
| S6-02 | Migration/index/repository, CAS, transaction + outbox                | S6-01               | Replica-set IT chứng minh unique/concurrency/rollback              |
| S6-03 | Send/accept/decline/cancel/unfriend, idempotency và quota            | S6-02               | Sai actor/request cũ không mutation; retry không trùng             |
| S6-04 | Block/unblock atomic và projection danh sách chặn                    | S6-02               | Block thắng accept, hai phía block độc lập                         |
| S6-05 | SocialAccessPolicy/public module API, profile/membership integration | S6-03–04, Stage 4–5 | Không vượt quyền qua direct URL/API                                |
| S6-06 | Cache authorization, outbox invalidation và client event contract    | S6-05               | Cache warm vẫn deny sau revoke; out-of-order không mở lại          |
| S6-07 | Controllers, OpenAPI, client generation và API contract tests        | S6-03–06            | Lỗi/CSRF/pagination/ownership đúng contract                        |
| S6-08 | UI bạn bè, profile actions, block settings và multi-tab invalidation | S6-07               | E2E hai user, trạng thái pending/cooldown/error đầy đủ             |
| S6-09 | Socket interceptor integration và tài nguyên tương lai fixtures      | S6-05–06            | Deny subscribe/reconnect/delivery, ghi rõ gate transport còn thiếu |
| S6-10 | Abuse/security/concurrency regression, audit/metrics/runbook         | S6-08–09            | Test matrix đạt, có hướng xử lý backlog và lỗi limiter             |
| S6-11 | Staging smoke, evidence và bàn giao Stage 7/9/11/12/14/17            | S6-10               | Báo cáo gate đạt/chưa đạt, không đóng stage khi còn gate bắt buộc  |

Mỗi PR chứa test cho thay đổi của nó; S6-10 là kiểm tra xuyên luồng, không dồn
toàn bộ test đến cuối. Owner và estimate được gán sau S6-00 theo trạng thái
thực tế Stage 3–5; không đưa ngày hoàn thành giả định khi đầu vào chưa đóng.

## 11. Ma trận kiểm thử bắt buộc

| Nhóm          | Ca kiểm thử                                                                    | Bằng chứng                                        |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| Domain        | Từng actor/transition; pending không là bạn; self action                       | Unit dùng fixed Clock                             |
| Cooldown      | Trước/đúng/sau 168 giờ, đổi chiều, cancel, block/unblock                       | Unit + REST IT                                    |
| Concurrency   | Gửi ngược chiều; accept/block; accept/cancel; hai bên block; resend/request cũ | Replica-set IT đồng bộ barrier, chạy nhiều lần    |
| Atomicity     | Crash trước commit, outbox lỗi, retry sau commit, duplicate delivery           | Fault injection, không partial state              |
| Authorization | Anonymous, actor thứ ba, IDOR, khóa account, CSRF, forged target               | HTTP IT qua security chain thật                   |
| Visibility    | PRIVATE/FRIENDS/COMMUNITY/PUBLIC × owner/friend/pending/stranger/blocked       | Parameterized policy + endpoint test              |
| Cache         | Làm nóng cache rồi unfriend/block/privacy change; Redis/worker lỗi             | Lần đọc mới deny, không chờ TTL                   |
| Web           | Hai browser context, tab cũ, reload, lỗi mạng, double submit, empty state      | Playwright E2E                                    |
| Socket        | Room người khác; revoke khi còn subscribe; reconnect; event trễ                | Adapter IT và E2E transport khi có                |
| Abuse         | Nhiều session/target, giới hạn pending race, Redis down                        | Rate-limit IT; revoke vẫn dùng được               |
| Ngoại lệ      | Active booking giữ liên hệ, ended booking readonly, review vẫn hợp lệ          | Contract fixtures; rerun integration stage sở hữu |
| Dữ liệu       | List/cursor/count không lộ blocked user; log/event không có dữ liệu riêng tư   | DTO/assertion và review log                       |

Các command theo pipeline repo: `pnpm check`, `pnpm api:check`, Maven Wrapper
`verify` với Docker/Testcontainers; E2E theo script được bổ sung trong PR UI.
Unit test hoặc `-DskipITs` không thay thế integration gate. Không ghi “pass”
cho test chưa chạy hoặc fixture chưa tích hợp tài nguyên thật.

## 12. Vận hành, rollout và rollback

- Audit mutation thành công/thất bại có actor, action, target reference,
  request/correlation ID và thời gian; giới hạn quyền đọc audit, không log body
  profile, số điện thoại, nội dung chat hoặc dữ liệu lịch.
- Metrics: transition/conflict/rate-limit counts, policy deny theo reason không
  nhạy cảm, latency, outbox lag/retry và revocation delivery failure. Không dùng
  user ID làm metric label; alert threshold chốt sau đo staging.
- Rollout migration/index trước, deploy policy tương thích event schema, bật
  read rồi mutation cho nhóm thử; kiểm tra revoke giữa hai tài khoản tổng hợp.
- Nếu có feature flag, tắt gửi/accept mới khi lỗi nhưng giữ enforcement block,
  quyền đọc và thao tác revoke. Không rollback về binary bỏ qua block đã lưu.
- Nếu invalidation lỗi: ngừng cache nội dung liên quan, authorize từ Mongo,
  replay outbox idempotent sau khắc phục. Nếu không đọc được policy thì deny
  tài nguyên bảo vệ; không phục vụ cache cũ để che lỗi.
- Rollback giữ dữ liệu quan hệ/cooldown/audit; migration additive, không drop
  collection hoặc xóa block để khôi phục dịch vụ.

## 13. Definition of Done và bàn giao

- G6-01–05 đạt; API/web hoạt động bằng dữ liệu tổng hợp, không sửa DB thủ công.
- Unique pair, cooldown, idempotency và race tests chạy trên replica set đạt.
- Profile/list/API/cache không còn đường vượt quyền; client gỡ nội dung khi
  có revoke event, server không tin client thực hiện việc này.
- OpenAPI/client đồng bộ; module boundary, formatting/lint, unit, IT và E2E đạt.
- Có migration, audit, metrics, rollback và evidence staging gắn commit SHA,
  môi trường, lệnh, kết quả, CI link và các hạn chế thực tế.
- Chỉ đánh dấu hoàn thành đầy đủ tiêu chí Stage 6 trong master khi có bằng
  chứng socket room thật. Nếu mới có harness, ghi “core hoàn tất, gate socket
  chờ Stage 12”; không đổi thành pass để đóng stage sớm.

| Stage nhận bàn giao  | Gate phải chạy lại trên tài nguyên thật                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| 7 — Lịch             | FRIENDS projection, privacy đổi và unfriend/block thu hồi ở lần đọc kế tiếp   |
| 9 — Feed             | Query/count/search/saved post và direct URL tuân thủ mọi visibility           |
| 11 — Booking         | Block ngăn tương tác mới nhưng giữ quyền nghiệp vụ booking đã có              |
| 12 — Chat/realtime   | DIRECT/BOOKING exceptions, subscribe/reconnect/delivery và gỡ nội dung từ xa  |
| 14 — Đánh giá        | Block/unfriend không hủy quyền review hợp lệ                                  |
| 17 — Hardening/pilot | Chuỗi kết bạn → chia sẻ lịch → hủy bạn/chặn → mất quyền trên API/cache/socket |

Các gate bàn giao phải có test case và owner trong PR nhận; contract test Stage 6
không tự chứng minh feature của stage sau đã hoàn thành.

## 14. Tiến độ implementation ngày 07/10/2026

Đồng bộ remote lên `f8b453f`: Stage 3–4 đã có code; Stage 5 chưa có. Phần rà
soát ở mục 2 giữ như lịch sử lúc lập kế hoạch, không mô tả checkout hiện tại.

| Hạng mục | Kết quả                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| S6-00    | Rà soát lại baseline; quyết định tại ADR 0014; gate Stage 5 còn thiếu                             |
| S6-01–04 | Có state machine, Mongo transaction/CAS/index, quota, receipt, outbox và block/unblock            |
| S6-05    | Có public policy và profile/search integration; membership chưa có để tích hợp                    |
| S6-06    | Primary reads/no-store, revision đồng bộ, polling 5 giây và BroadcastChannel; chưa có socket push |
| S6-07    | 12 REST operations, OpenAPI và generated client; test đối chiếu từng route                        |
| S6-08    | Web `/friends`, profile actions, pagination, search và quản lý block                              |
| S6-09    | Chưa có STOMP transport/harness; không đánh dấu gate socket đạt                                   |
| S6-10    | Có unit/API/UI tests, replica-set IT, audit và runbook; IT cần Docker để xác nhận                 |
| S6-11    | Chưa chạy staging smoke; chưa nghiệm thu đầy đủ Stage 6                                           |

Khác biệt đã quyết định: quota Mongo fixed-window thay Redis cho lời mời; cursor
pair ID thay updatedAt; polling là cơ chế tạm trong khi chờ realtime. Xem ADR
0014 để biết lý do và giới hạn. Không bật tính năng của stage sau bằng fixture.
