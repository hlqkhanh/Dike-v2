# STAGE 10 — Trip và quản lý chỗ

Ngày lập: 07/10/2026. Baseline: `4ccb525` trên `main`.
Trạng thái: Kế hoạch, chưa triển khai. Master/ADR Accepted ưu tiên hơn đề xuất
thiết kế dưới đây. Đọc cùng [Stage 9](STAGE_9.md) và [Stage 11](STAGE_11.md).

## 1. Mục tiêu, scope và gate

Chủ xe tạo chuyến một chiều từ xe đã duyệt; quản lý tuyến, điểm dừng, chỗ và
mức đóng góp. Không overbook và không tạo lịch thực hiện chuyến xung đột.
Nguồn: master mục 6.1–6.4, 8, 11.5–11.7, Giai đoạn 10.

Baseline `ride` mới có package declaration, chưa có Trip/Booking repository.
Không giả định những gate dưới đây đã có bằng chứng nghiệm thu.

| Gate   | Đầu vào                                                                  |
| ------ | ------------------------------------------------------------------------ |
| G10-01 | Stage 5: APPROVED_DRIVER, vehicle approval/capacity/status và membership |
| G10-02 | Stage 6: social access/block và account policy                           |
| G10-03 | Stage 8: route/ETA/detour snapshot, server contribution configuration    |
| G10-04 | Stage 9A: Post API/termsVersion; offer integration làm ở 9B              |
| G10-05 | Mongo replica-set transaction, migrations, outbox và clock               |

Trong scope: draft/open, edit/cancel trước booking, stops nền, seat primitive,
driver availability, offer integration, web và test. Stage 11 bổ sung booking,
boarding, no-show, early end và completion thật. Stage 13 cung cấp GPS/presence.
Không public endpoint giảm/tăng chỗ tùy ý, không giả booking để chứng minh UI.

Thứ tự: Stage 9A → Stage 10 → Stage 9B → Stage 11. Có thể xây domain/contract
trước khi gate khác hoàn tất; không enable production bằng adapter giả.

## 2. Invariant và quyết định cần chốt

- Driver account active, APPROVED_DRIVER hiệu lực, xe đã duyệt thuộc quyền sử dụng.
- Motorcycle tối đa 1 khách; car không vượt passenger capacity đã duyệt.
- Mỗi passenger account đặt đúng 1 chỗ/booking; không tái bán chỗ theo đoạn.
- `0 <= remainingSeats <= offeredSeats <= approvedPassengerCapacity`.
- Có nhiều chuyến tương lai nếu không xung đột; không có khóa “một chuyến/account”.
- Mức đóng góp/km từ 0 đến mức gợi ý server; VND integer và rounding theo Stage 8.
- OPEN/FULL là trước xuất phát; IN_PROGRESS không nhận mới dù có chỗ trống.
- Route gốc bất biến làm mốc detour, route cam kết thay đổi có version riêng.

| Điểm cần chốt   | Đề xuất                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| Capacity xe     | Adapter trả số chỗ khách, không tổng ghế gồm lái xe; chưa rõ thì không suy đoán          |
| Giữ lịch driver | DRAFT chưa giữ lịch; OPEN/FULL giữ interval thực hiện toàn trip + buffer                 |
| Interval        | Half-open [start,end), cộng 15 phút cuối theo master; chốt buffer driver trong ADR       |
| Khi có booking  | Không giảm capacity/đổi xe/tuyến/giờ/giá ảnh hưởng cam kết                               |
| Đổi visibility  | Không làm mất quyền nghiệp vụ booking cũ; chỉ tác động tìm/đề nghị mới                   |
| Expire          | Không expire chuyến có booking đang thực hiện; chuyến chưa khởi hành quá hạn cần rule rõ |

Chốt riêng cutoff mở/expiry cho trip có khách CONFIRMED nhưng driver không start:
không tự xóa booking hay giải phóng availability chỉ vì worker đi qua departureAt.
Stage 11/operations phải có xử lý chuyến trễ và liên hệ khách.

## 3. Module, dữ liệu và migration

`ride` sở hữu Trip, TripStop, availability lock và seat mutation; module khác
chỉ gọi public application API. `planning` sở hữu offer, không ghi remainingSeats.

| Aggregate/dữ liệu     | Trường chính                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trip                  | id, driverId, vehicleId/approvalVersion, status, departureAt, originalRouteSnapshotId, committedRouteSnapshotId, routeVersion, termsVersion, version |
| Điều kiện trip        | offeredSeats, remainingSeats, detour limits, contribution policy reference/version, visibility, communityId, notes                                   |
| TripStop              | id, tripId, bookingId nullable, kind ORIGIN/PICKUP/DROPOFF/DESTINATION, sequence, location reference, ETA/window, version                            |
| Availability          | userId, reservationId, trip/booking reference, role, startAt/endAt, active/status                                                                    |
| UserAvailabilityGuard | Một record/user với version, dùng serialize cập nhật interval                                                                                        |
| Seat operation        | business operation ID/idempotency receipt, booking reference khi có Stage 11                                                                         |

Index: driverId/departureAt/status; status/departureAt/id; GeoJSON tuyến; unique
tripId/stopId và sequence theo phương án cập nhật atomic; availability userId/
active/startAt/endAt; unique reservationId và user guard ID. Mongo index không
tự ngăn overlapping ranges, cần guard transaction ở mục 5.

Migration additive, kiểm capacity dữ liệu hiện có và báo lỗi bất biến; không
tự sửa counter cho “khớp”. Derived route/offer projections mang sourceVersion.
Outbox payload versioned không chứa mã boarding hoặc tọa độ private không cần thiết.

## 4. State machine và edit

| Command             | Transition / ràng buộc                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| Create              | DRAFT, owner có xe hợp lệ, validation input                             |
| Open                | DRAFT → OPEN, route còn hợp lệ, availability không trùng, đủ quyền      |
| Reserve last seat   | OPEN → FULL cùng transaction accept Stage 11                            |
| Release trước start | FULL → OPEN nếu đủ điều kiện, không tự reopen owner-closed offer        |
| Start               | OPEN/FULL → IN_PROGRESS; Stage 11 kiểm booking/stops và vô hiệu pending |
| Complete            | IN_PROGRESS → COMPLETED khi mọi người đã boarded có trạng thái cuối     |
| Cancel              | DRAFT/OPEN/FULL → CANCELLED; khi đã có booking qua coordinator Stage 11 |
| Expire              | Chỉ khi thỏa rule cutoff và không che active obligation                 |

Nếu chưa có booking: edit expectedVersion, tính route ngoài transaction, vào
transaction so source version, kiểm guard rồi thay interval/terms. Nếu có pending
proposal: tăng termsVersion và vô hiệu đề nghị cũ. Nếu có booking: reject sửa
cam kết, hướng dẫn hủy đúng quy trình rồi tạo mới. Không nhận giá/chỗ tính ở client.

## 5. Chỗ, lịch bận và tuyến dưới concurrency

Seat primitive chỉ dùng nội bộ application transaction:

1. Kiểm trip OPEN, expected terms/route version, `remainingSeats > 0`.
2. Conditional update version/status/counter; giảm đúng một chỗ.
3. Nếu hết chỗ đặt FULL. Result modified=0 trả NO_SEATS hoặc TRIP_CHANGED.
4. Stage 11 ghi Booking/Proposal/Post/Availability/Outbox trong cùng transaction.
5. Release dựa trên transition booking từ trạng thái giữ chỗ sang terminal,
   có operation ID; không tăng chỗ hai lần do retry/cancel event trùng.

Không cấp reservation khi gửi proposal. Không Redis lock cho ghế; Mongo là
nguồn chân lý. Test Stage 10 gọi primitive bằng transaction harness; test cuối
phải được chạy lại qua accept endpoint thật ở Stage 11.

Để chống hai trip khác nhau cùng driver hoặc hai booking khác trip cùng user:
ghi tăng version của guard user trong transaction trước query overlap. Hai
transaction cùng user phải write-conflict; loser retry đọc lại lịch hiện tại.
Lock nhiều user theo ID ổn định; tạo guard dùng unique ID, xử lý duplicate bằng
retry toàn transaction. Không chỉ `find overlap rồi insert`, vì dễ write skew.

Route insertion cho ô tô giữ thứ tự các stop đã cam kết, pickup mới trước dropoff,
kiểm mọi deadline và tổng detour so original route. Gọi Goong trước transaction,
gắn fingerprint tripVersion/stopVersion; vào transaction so lại fingerprint,
nếu stale tính lại bên ngoài. Không giữ transaction mở trong lúc gọi provider.

Bắt đầu chuyến đóng nhận khách. Passenger xuống sớm không tạo inventory bán lại.
Hủy trước start có thể trả chỗ đúng một lần; quy tắc sau start do Stage 11 quản lý.

## 6. API và UI đề xuất

Base `/api/v1`, session/Origin/CSRF; mutation dùng Idempotency-Key + expectedVersion.

| API                     | Chức năng                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| POST /trips             | Draft trip, lấy giá/capacity từ nguồn có thẩm quyền               |
| GET /trips/{id}         | Projection owner/member/public; block và visibility đúng context  |
| GET /trips?scope=mine   | Danh sách owner phân trang và lịch sử                             |
| PATCH /trips/{id}       | Sửa điều kiện hợp lệ, không làm đổi booking âm thầm               |
| POST /trips/{id}/open   | Reserve driver interval, mở trip idempotent                       |
| POST /trips/{id}/cancel | Stage 10 dùng khi chưa có booking; Stage 11 điều phối các booking |
| GET /trips/{id}/stops   | Bản giảm dữ liệu hoặc manifest chỉ owner/participant được phép    |

Start/complete chính thức được thêm ở Stage 11, không expose lệnh chuyển status
tùy ý. NO_SEATS/TRIP_CHANGED/AVAILABILITY_CONFLICT/VEHICLE_NOT_APPROVED là lỗi
domain; 404 che private resource, 409 state/version, 422 capacity/input, 503 routing.

Web wizard: xe đã duyệt → tuyến/giờ → số chỗ/detour → contribution/visibility →
preview → mở chuyến. Hiển thị “chỗ khách”, không gồm driver; báo xung đột có
link tài nguyên của chính user nhưng không lộ lịch người khác. Trip detail khác
manifest; không expose danh sách passenger cho người xem feed.

## 7. Backlog

| ID     | Đầu ra                                         | Phụ thuộc           | Acceptance                                    |
| ------ | ---------------------------------------------- | ------------------- | --------------------------------------------- |
| S10-00 | Capacity/cutoff/availability ADR và gate audit | G10-01–05           | Rõ các rule đề xuất                           |
| S10-01 | Trip/Stop domain, schema/index/migration       | S10-00              | Invariant/capacity tests                      |
| S10-02 | Draft/open/edit route và vehicle adapter       | S10-01, Stage 8     | Không call provider trong transaction         |
| S10-03 | User guards/driver intervals                   | S10-02              | Race 2 trip trùng giờ chỉ 1 mở                |
| S10-04 | Conditional reserve/release primitive          | S10-01              | Last seat race và duplicate release đạt       |
| S10-05 | Route insertion/committed stops contract       | S10-02              | Thứ tự stop/deadline/detour không phá cam kết |
| S10-06 | Public Trip API + offer integration            | S10-03–05, Stage 9A | Chỗ/giá một nguồn, 9B hoạt động               |
| S10-07 | REST/OpenAPI/UI                                | S10-06              | Wizard/detail/error/E2E                       |
| S10-08 | Expiry/reconcile/outbox/runbook                | S10-06              | Job replay không mất nghĩa vụ chuyến          |
| S10-09 | Concurrency/security/load evidence             | S10-07–08           | Replica-set tests, CI và smoke đạt            |

## 8. Kiểm thử và nghiệm thu

| Nhóm              | Test                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Seat              | 2 request tranh chỗ cuối đúng 1 thắng; 20 request không vượt capacity; counter không âm      |
| Release           | Retry/cancel trùng, release khi trip IN_PROGRESS/CANCELLED; không bán lại đoạn               |
| Availability      | Hai trip trùng driver; cross-midnight UTC; interval sát biên và buffer 15 phút               |
| Vehicle/authority | Xe hết duyệt/đổi capacity/account khóa trước open và trước accept                            |
| Route             | Ngược chiều, thêm stop phá deadline, detour tích lũy, snapshot stale/provider timeout        |
| Atomicity         | Lỗi sau giảm chỗ rollback counter/booking harness/outbox; retry commit không reserve hai lần |
| Access/UI         | Private trip/manifest URL, block, nonmember, forged driverId/price/capacity                  |
| Replay            | Outbox lặp/đảo thứ tự, offer FULL→OPEN nhưng owner đã close                                  |

Integration bắt buộc replica set thật, barrier cho race, lặp nhiều lần và kiểm
final state trong DB. Mock chỉ phù hợp unit/adapter boundary. Khi Stage 11 ra
mắt, thay harness bằng accept/cancel E2E và kiểm một booking/seat operation.

Metrics: seat conflicts, availability conflicts, route staleness, invariant
violations và outbox age. Reconcile job chỉ báo mismatch, không tự tăng chỗ để
che lỗi. Rollout migration additive rồi API/worker cùng version; rollback phải
giữ conditional writes và đọc được booking đã nhận. Emergency stop nhận mới,
giữ quyền đọc/liên hệ chuyến đang thực hiện.

DoD: toàn bộ S10 đạt, conditional race thật đạt, capacity/overlap/route tests,
OpenAPI/client và UI đã kiểm; runbook gắn SHA, lệnh/kết quả, staging smoke.
Gate booking lifecycle/accept endpoint Stage 11 ghi riêng, không tuyên bố hoàn
tất hành trình khách chỉ bằng primitive seat tests.
