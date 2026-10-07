# STAGE 9 — Bài đăng và bảng tin

Ngày lập: 07/10/2026. Baseline: `4ccb525` trên `main`.
Trạng thái: Kế hoạch, chưa triển khai/ nghiệm thu. Master plan và ADR Accepted
có ưu tiên cao hơn các đề xuất schema/API trong tài liệu này.

## 1. Mục tiêu và đầu vào

Đăng nhu cầu có kiểm tra trước khi công khai, tìm bài đúng quyền và đúng tuyến,
lưu/báo cáo bài; feed không rò thông tin khi truy cập URL, search hoặc cache.
Nguồn: master mục 4, 5.2–5.5, 8.1, 11.3–11.9, Giai đoạn 9.

Tại baseline, `planning` và `ride` mới có khai báo module. Stage 6 có social
policy/profile integration nhưng chưa đóng gate socket. Không coi Stage 5, 7,
8 hay 10 là đã có chỉ vì master đã mô tả.

| Gate  | Yêu cầu trước khi nghiệm thu                                            |
| ----- | ----------------------------------------------------------------------- |
| G9-01 | Stage 3/5: VERIFIED_MEMBER, account active và membership có thẩm quyền  |
| G9-02 | Stage 6: friends/block và thu hồi quyền đọc, có test thực tế            |
| G9-03 | Stage 7: intent theo ngày/chiều, sourceVersion, projection lịch FRIENDS |
| G9-04 | Stage 8: route snapshot, latest departure, quote và lỗi provider        |
| G9-05 | Stage 10: public Trip API cho OFFER_RIDE và quyền owner/driver          |
| G9-06 | Mongo replica set, outbox, OpenAPI/client pipeline, dữ liệu tổng hợp    |

Chia triển khai: **9A** làm NEED_RIDE, feed nền và Trip port contract; **10** xây
Trip; **9B** tích hợp OFFER_RIDE thật. Không đóng Stage 9 bằng Trip mock. Stage
11 bổ sung booking/proposal reconciliation; trước đó UI không giả lập nhận chuyến.

## 2. Phạm vi và quyết định

Trong phạm vi: draft/publish/edit/close/expire, saved posts, report intake, bốn
tab, cursor, lọc, matching ranking, link sharing, privacy, web và telemetry.
Không xây chat/socket, live GPS, booking, moderation dashboard, mobile hoặc
thu tiền. CTA gửi đề nghị chỉ mở khi Stage 11 sẵn sàng.

| Quyết định            | Đề xuất cần chốt ở S9-00                                                |
| --------------------- | ----------------------------------------------------------------------- |
| Một bài mở mỗi intent | Partial unique trên intentId với OPEN; publish kiểm cả booking active   |
| Một offer mỗi trip    | Unique tripId cho OFFER_RIDE để mở lại cùng bài khi còn chỗ             |
| Edit điều kiện        | Tăng termsVersion khi đổi tuyến/giờ/giá; cosmetic edit chỉ tăng version |
| Đóng bài              | CLOSED không tự hủy trip/booking; không tự mở lại bài chủ đã đóng       |
| Báo cáo               | `trust` nhận report bền vững, idempotent; dashboard xử lý ở Stage 14    |
| Địa điểm feed         | Khu vực/điểm công cộng; tọa độ chính xác chỉ theo projection có quyền   |
| Lọc/ranking           | Đúng điều kiện trước, nhóm bạn bè sau đó mới score; ID làm tie-break    |

Không áp claim phù hợp khi chưa chọn nhu cầu hoặc thiếu route snapshot hợp lệ.
Tab Phù hợp yêu cầu chọn intent/nhập nhu cầu; không tự chọn trong nhiều lịch.

## 3. Ownership, schema và index

`planning` sở hữu RidePost, SavedPost, query/ranking và public Post application
API. `ride` sở hữu Trip/chỗ/giá và sau này acceptance. `trust` sở hữu Report.
Chỉ gọi named interface/public API; không đọc repository module khác.

| Dữ liệu            | Nội dung tối thiểu                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| RidePost           | id, ownerId, type, intentId hoặc tripId, status, visibility, communityId, ghi chú, version, termsVersion, publishedAt, expiresAt |
| NEED_RIDE snapshot | sourceIntentVersion, routeSnapshotId, thời gian, vehicle preference, projection công khai đã duyệt                               |
| OFFER_RIDE         | Tham chiếu Trip; không có bộ chỗ/giá authoritative riêng                                                                         |
| SavedPost          | viewerId, postId, savedAt; unique cặp, không copy nội dung riêng tư                                                              |
| Report             | reporterId, resourceType/id, reason enum, text giới hạn, status, timestamp, idempotency receipt                                  |

Index migration: partial unique OPEN intentId; partial unique OFFER tripId;
`status/visibility/publishedAt/id`, `communityId/status/publishedAt/id`,
`ownerId/status/id`, saved pair và viewer/savedAt/id; GeoJSON `2dsphere` cho
candidate lookup phù hợp. Dùng explain và dataset đại diện để chốt thứ tự index.
Không TTL xóa bài hết hạn hoặc lịch sử. Job expiry có index status/expiresAt.

Offer có thể có projection phục vụ search, kèm tripVersion nhưng không dùng nó
quyết định số chỗ hoặc giá khi trả chi tiết/gửi đề nghị. Gọi Trip API batch để
tránh N+1; nếu không thể kiểm tra thì không quảng bá là còn chỗ.

## 4. Vòng đời và đồng bộ

| Transition             | Actor/điều kiện                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------- |
| DRAFT → OPEN           | Owner VERIFIED_MEMBER, đủ dữ liệu/quyền/route; offer cần APPROVED_DRIVER và Trip OPEN |
| OPEN → CLOSED          | Owner; đóng việc tìm, không hủy booking                                               |
| OPEN → EXPIRED         | Giờ server vượt mốc hợp lệ; NEED arrive-before dùng latestDeparture từ route          |
| OPEN → MATCHED         | NEED đã có booking hoặc offer hết chỗ; Stage 11 ghi nguyên tử                         |
| MATCHED → OPEN         | Chỉ offer do hết chỗ, trip vẫn OPEN, trước khởi hành và chỗ trở lại                   |
| OPEN/DRAFT → CANCELLED | Nguồn bị hủy qua use case được quy định, không đồng nghĩa đóng bài                    |

Đề xuất lưu closureReason để phân biệt AUTO_FULL với OWNER_CLOSED; không mở lại
OWNER_CLOSED bằng event trả chỗ. NEED bị hủy booking phải chọn Tìm lại, không
tự đăng lại. Chốt trạng thái nguồn khi Tìm lại tại Stage 11.

Publish/edit dùng expectedVersion, Idempotency-Key, unique index và transaction.
Thay đổi lịch gốc chỉ cảnh báo source changed, không ghi đè bài đã công khai.
Khi có booking, từ chối sửa điều kiện ảnh hưởng booking. Với pending proposal,
edit terms vô hiệu đề nghị cũ: accept luôn so termsVersion ngay cả worker đang
trễ; cleanup status qua transaction/public module API theo thiết kế Stage 11.

## 5. Feed, matching và privacy

1. Xác thực account; lấy viewer policy hiện tại, block và membership.
2. Lọc OPEN, chưa hết hạn, loại đối ứng, vehicle, thời gian và phạm vi truy cập.
3. Lọc hành lang tuyến; kiểm chiều pickup trước dropoff, detour so tuyến gốc,
   deadline và chỗ qua Stage 8/10. Tối đa 20 ứng viên route chi tiết mỗi đợt theo master.
4. Trong tập hợp lệ, ưu tiên accepted friends; rồi detour/ETA, lệch giờ,
   community và rating đúng vai trò nếu đã có. Chưa có rating thì neutral,
   không tự gán 0 sao. Stable ID xử lý bằng điểm.
5. Projection theo viewer; cursor và total/count không tiết lộ bài bị lọc.

Tab Bạn bè: Bài đăng và Lịch sắp tới 7 ngày là hai vùng riêng. Lịch dùng API
Stage 7 đã giảm dữ liệu; không hiển thị như lời mời đang tìm xe. Community tab
không cho friend ngoài cộng đồng vượt membership. PUBLIC vẫn cần đăng nhập.

Cursor opaque có sort tuple, query fingerprint, selected intent version và
cutoff; ký/xác thực server. Đề xuất TTL 15 phút cho matching cursor. Reject khi
đổi query; vẫn kiểm quyền lại từng page, không đóng băng quyền trong cursor.
Candidate scan có giới hạn, timeout và next cursor rõ ràng; không hứa feed toàn
diện nếu chỉ xếp hạng 20 ứng viên đầu. Đo recall/latency trước chọn scan budget.

Không cache allow. Content cache viewer-scoped kèm source versions và kiểm quyền
trước cache hit. Unfriend/block/privacy/membership revoke phải deny ở read kế
tiếp kể cả worker ngừng. Event chỉ mang ID/revision; reset client queries và
không lưu route riêng tư vào share preview, notification hoặc browser metadata.

## 6. REST và giao diện đề xuất

Base `/api/v1`, dùng same-origin proxy/session/CSRF. Actor từ principal.

| API                              | Hành vi                                                   |
| -------------------------------- | --------------------------------------------------------- |
| POST /ride-posts                 | Tạo draft từ intentId/tripId và expected source version   |
| PATCH /ride-posts/{id}           | Sửa draft/bài, expectedVersion và phân loại terms         |
| POST /ride-posts/{id}/publish    | Kiểm quyền/source và publish idempotent                   |
| POST /ride-posts/{id}/close      | Đóng bài; UI nói rõ booking vẫn giữ                       |
| GET /ride-posts/{id}             | Detail projection, kiểm quyền dù mở link trực tiếp        |
| GET /ride-posts                  | Tab/filter/cursor; owner history là query riêng có quyền  |
| GET /saved-posts                 | Loại dữ liệu đã mất quyền; không phục hồi snapshot cũ     |
| PUT/DELETE /saved-posts/{postId} | Save/unsave idempotent                                    |
| POST /reports                    | Gửi report tới trust; không cho reporter đọc audit nội bộ |

Lỗi chung: 401/403/404 không tiết lộ nguồn private; 409 version/source/booking
conflict; 422 input; 429 Retry-After; 503 provider unavailable. Cooldown/rate
limit dùng server config; đề xuất publish 10/giờ, report 10/giờ/account, review
trước enable và không dùng quota publish để khóa close/report an toàn.

Web: composer preview trước publish; chọn visibility/community rõ ràng; nguồn
đã đổi có cảnh báo; skeleton/empty/error/retry, lưu filter, load-more, mobile,
keyboard. Disabled CTA giải thích khi chưa có Stage 11, không dùng mock success.

## 7. Backlog và thứ tự PR

| ID    | Đầu ra                                        | Phụ thuộc        | Nghiệm thu                                     |
| ----- | --------------------------------------------- | ---------------- | ---------------------------------------------- |
| S9-00 | Gate audit, projection/terms/cursor decisions | G9-01–04         | Rule matrix khớp master                        |
| S9-01 | RidePost/SavedPost domain, migration/index    | S9-00            | State tests, unique publish race               |
| S9-02 | NEED draft/publish/edit/close/expiry          | S9-01, Stage 7–8 | Không tự đăng từ lịch, idempotent              |
| S9-03 | Policy read/detail/search/cache               | S9-02, Stage 6   | IDOR, direct link, cache revoke đạt            |
| S9-04 | Feed tabs/filter/cursor/ranking               | S9-03            | Không boost friend sai tuyến, stable pages     |
| S9-05 | Saved/report intake và outbox                 | S9-03            | Không leak saved snapshot, report bền vững     |
| S9-06 | OpenAPI/generated client và UI 9A             | S9-02–05         | Contract/E2E composer và feed                  |
| S9-07 | OFFER Trip adapter/UI 9B                      | S9-06, Stage 10  | Chỗ/giá/visibility từ Trip thật                |
| S9-08 | Stage 11 terms/booking integration            | Stage 11         | Accept/edit/full/reopen không lệch             |
| S9-09 | Load/security/operations/evidence             | S9-07            | Gate p95/privacy đạt, ghi nợ S9-08 nếu chưa có |

## 8. Test, vận hành và DoD

| Nhóm        | Ca bắt buộc                                                                                |
| ----------- | ------------------------------------------------------------------------------------------ |
| Domain/API  | Publish hai lần, self/source ownership, stale version, expiry boundary, clock UTC          |
| Quyền       | PUBLIC/COMMUNITY/FRIENDS × stranger/friend/member/blocked; search/count/saved/detail/cache |
| Matching    | Ngược chiều, pickup sau dropoff, deadline cứng, detour cộng dồn, thiếu routing             |
| Concurrency | Hai publish cùng intent; edit vs accept; expire vs publish; close vs seat reopen           |
| UI          | Preview, history, revoke khi đang mở, stale cursor, mobile và accessibility                |
| Resilience  | Worker chết/replay/out-of-order; Redis lỗi; routing timeout không fallback đường thẳng     |

Benchmark bắt buộc: 1.000 chuyến tổng hợp có phân bố visibility/tuyến/giờ, cả
warm/cold cache; báo hardware, concurrency, số request, p50/p95/error và query
explain. Acceptance p95 < 2 giây cho feed theo master; đề xuất đo 10 client đồng
thời trong 5 phút sau warmup, chốt workload ở S9-00. Tách latency provider và
không bỏ request lỗi khỏi báo cáo để làm đẹp p95.

Metrics: feed latency, candidates scanned, routing calls/timeouts, policy deny,
expiry/outbox lag; không metric-label user/coordinate. Rollout additive index,
giới hạn nhóm pilot; rollback giữ privacy enforcement và lịch sử. Có thể dừng
publish mới, không bật phục vụ cached private content khi dependency lỗi.

DoD: test unit/module/HTTP/replica-set/E2E và `pnpm check`, `pnpm api:check`,
Maven `verify` đạt không dùng skip làm bằng chứng; benchmark đạt; runbook/evidence
gắn SHA. Offer cần Stage 10 thật; ghi rõ integration Stage 11 và socket Stage 12
còn thiếu, không gọi Stage 9 hoàn tất nếu chưa đạt phần trong scope.
