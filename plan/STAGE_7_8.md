# STAGE 7–8 — Lịch, nhu cầu di chuyển, địa điểm và định tuyến

Ngày lập: 07/10/2026.

Trạng thái: kế hoạch triển khai chung cho Stage 7 và Stage 8. Hai stage được ghép
vì lịch cần địa điểm chuẩn hóa và tuyến đường để tạo `TravelIntent` đúng thời
gian; vẫn giữ ranh giới domain để có thể review và phát hành từng phần.

## Tiến độ implementation

Baseline bắt đầu: `60340b9` trên `main`.

- `S78-00`: In progress — runbook/ADR/dependency đã có; baseline checks local còn
  thiếu Docker integration test không skip.
- `S78-01`: Implemented — simulated driver approval chỉ local/test, evidence API
  và hosted startup guard đã có từ baseline.
- `S78-02`: Implemented, pending Docker evidence — schedule/exception/intent domain,
  Mongo documents, optimistic store và unique indexes đã có; integration test cần
  chạy với Docker replica set.
- `S78-03`: In progress — typed config, hosted Goong guard, provider port, Goong
  adapter, deterministic fake, error mapping, retry budget, circuit breaker và
  polyline decode đã có; còn telemetry và staging provider smoke.
- `S78-04`: Implemented, pending Redis integration evidence — one-use place
  session, opaque `placeRef`, owner-scoped resolved-place snapshot, user/IP rate
  limit và API autocomplete/detail đã có.
- `S78-05`: In progress — owner schedule CRUD, pause/resume/end, exception,
  optimistic version và conflict use case/API đã có; còn API integration tests và
  response warning ngay lúc save.
- `S78-06`: In progress — outbox signal, rolling 14-day materializer, distributed
  Redis lease, idempotent private-intent reconciliation và immutable committed
  intent handling đã có; còn manual-intent API và concurrency evidence bằng Docker.
- `S78-07`: In progress — HMAC-keyed Redis route cache, route snapshot/geometry,
  owner isolation, expiry và deterministic contribution estimate/API đã có;
  hosted chặn demo policy; còn cache integration test và telemetry.
- `S78-08` đến `S78-13`: Chưa triển khai.

## 1. Mục tiêu và quyết định đã khóa

Sau stage này, người dùng tạo lịch đi/về lặp theo tuần, sửa ngoại lệ từng ngày,
xem xung đột và để worker tạo trước nhu cầu di chuyển 14 ngày. Bạn bè chỉ thấy
projection an toàn. Backend dùng Goong để tìm địa điểm, tính tuyến đường, ETA và
chi phí đóng góp ước tính.

Quyết định:

- Stage 5 eKYC thật được hoãn theo
  [ADR 0015](../docs/architecture/adr/0015-deferred-ekyc-and-simulated-driver-approval.md).
  Local/test suy ra quyền tài xế thử nghiệm cho mọi `VERIFIED_MEMBER`; không ghi
  role thật. Staging/production vẫn yêu cầu `APPROVED_DRIVER` thật.
- Stage 7 và 8 dùng chung runbook này nhưng triển khai thành các lát dọc nhỏ.
- `planning` sở hữu lịch, ngoại lệ, travel intent, routing query và route
  snapshot. `community` chỉ cung cấp `SocialAccessPolicy`; không module nào đọc
  repository nội bộ của module khác.
- Goong là provider bắt buộc cho local, staging và production. Test tự động dùng
  deterministic fake hoặc HTTP stub; không dùng fake provider trong runtime
  hosted.
- Stage 8 chỉ tạo `ContributionEstimate` không ràng buộc và có hạn dùng. Stage 10
  thuộc `ride` mới tạo `ContributionQuote` bền vững từ route snapshot.
- Web Stage 7–8 chưa có bản đồ tương tác. Người dùng có autocomplete, chọn điểm,
  tóm tắt tuyến, khoảng cách, ETA, đường tuyến SVG đơn giản và chi phí ước tính;
  chưa có bản đồ nền, kéo marker, navigation hoặc theo dõi xe như Grab/GreenSM.
- V1 chỉ nhận `Asia/Ho_Chi_Minh`; vẫn lưu `zoneId` để nâng cấp sau. Mọi instant
  lưu UTC, mọi ngày/giờ lặp lưu theo local date/time.
- Không dùng khoảng cách đường thẳng làm tuyến dự phòng khi Goong lỗi.

Ngoài phạm vi:

- eKYC, duyệt xe, membership cộng đồng và quyền tài xế thật — Stage 5.
- Bản đồ tương tác, GPS navigation và live tracking — stage sau.
- Đăng intent lên bảng tin — Stage 9; trip/xe/chỗ/quote chính thức — Stage 10.
- Matching, proposal, booking và thanh toán — Stage 11 trở đi.
- React Native/Expo UI — Stage 16.

## 2. Điều kiện đầu vào và gate

- Stage 1 infrastructure, Mongo transaction/outbox, worker profile và OpenAPI
  generation phải xanh.
- Stage 2–4 cung cấp session, OTP authority, profile và privacy.
- Stage 6 cung cấp friendship/block và policy thu hồi quyền trên mỗi lần đọc.
- MongoDB phải chạy replica set; Redis sẵn sàng cho cache/rate limit.
- Có Goong REST API key riêng cho từng môi trường. Key chỉ ở backend secret;
  không dùng `NEXT_PUBLIC_` và không đưa vào response/log/artifact.
- Trước PR đầu tiên, chạy `pnpm check`, `pnpm api:check` và
  `./mvnw -B -ntp verify`; baseline đỏ phải được xử lý riêng.

Stage 7–8 có thể hoàn thành cho local/test khi Stage 5 hoãn, nhưng không được gọi
là production-ready. Pilot vẫn bị chặn bởi eKYC/phương tiện thật.

## 3. Kiến trúc module

```text
com.dike.planning
  api/                   REST controllers, request/response DTO
  application/           schedule, materialization, routing use cases
  domain/                rules, exceptions, intents, route/estimate policy
  infrastructure/
    mongo/               documents, repositories, index migrations
    routing/goong/       HTTP adapter and provider DTO isolation
    redis/               short-lived routing cache and provider limiter
    worker/              rolling-horizon materializer
```

Controller chỉ gọi application service. Domain không phụ thuộc Spring MVC,
MongoDB, Redis hoặc JSON của Goong. Provider DTO không đi qua public API. External
call diễn ra ngoài Mongo transaction; transaction chỉ ghi snapshot và aggregate
sau khi kết quả provider hợp lệ.

Public module interface tối thiểu:

- `PlanningAccess`: đọc intent/route snapshot đã kiểm owner cho Stage 9–11.
- `RoutePlanning`: tính tuyến và estimate từ địa điểm chuẩn hóa.
- `SocialAccessPolicy` của community được gọi khi đọc lịch bạn bè.
- `AccountAccessService` của identity quyết định `VERIFIED_MEMBER` và
  `APPROVED_DRIVER`; planning không tự suy luận từ dữ liệu Mongo.

## 4. Domain và dữ liệu

### 4.1. ScheduleRule

Collection `schedule_rules`:

| Field                             | Quy tắc                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `id`, `ownerUserId`               | ID server và chủ sở hữu bất biến                              |
| `name`, `activityCategory`        | Tên riêng chỉ owner thấy; category công khai có kiểm soát     |
| `weekdays`                        | Tập `MONDAY`–`SUNDAY`, không rỗng                             |
| `effectiveFrom`, `effectiveUntil` | LocalDate; ngày kết thúc nullable và không trước ngày bắt đầu |
| `startLocalTime`, `endLocalTime`  | Sự kiện phải cùng ngày; qua đêm bị từ chối trong v1           |
| `zoneId`                          | Chỉ `Asia/Ho_Chi_Minh` trong v1                               |
| `activityPlace`, `usualOrigin`    | `PlaceSnapshot` có exact point riêng tư và public area label  |
| `arrivalBufferMinutes`            | 0–180, dùng tính deadline chiều đi                            |
| `directions`                      | Tập không rỗng gồm `OUTBOUND`, `RETURN`                       |
| `defaultTravelRole`               | `RIDER`, `DRIVER`, `UNKNOWN`                                  |
| `visibility`                      | `PRIVATE` mặc định hoặc `FRIENDS`                             |
| `status`                          | `ACTIVE`, `PAUSED`, `ENDED`                                   |
| `version`, timestamps             | Optimistic locking và audit                                   |

`DRIVER` chỉ hợp lệ khi authority hiện tại có `APPROVED_DRIVER`. Quyền
`SIMULATED` đủ cho local/test nhưng response phải giữ evidence để UI gắn nhãn.
`UNKNOWN` không tự publish và phải hỏi vai trò khi Stage 9 đăng intent.

### 4.2. PlaceSnapshot

Giá trị nhúng gồm `provider`, `providerPlaceId`, `displayLabel`, `publicAreaLabel`,
GeoJSON `Point` `[longitude, latitude]` và thời điểm resolve. Không lưu raw Goong
response. Owner/API nội bộ được nhận exact point; friend projection chỉ nhận
`publicAreaLabel`, tuyệt đối không trả place ID, địa chỉ đầy đủ hoặc tọa độ.

### 4.3. ScheduleException

Collection `schedule_exceptions`, unique `(scheduleId, localDate)`:

- `SKIP`: không sinh intent ngày đó.
- `OVERRIDE`: thay thời gian, origin, activity place và/hoặc directions cho đúng
  ngày; field không có giá trị kế thừa schedule.
- Exception phải nằm trong khoảng hiệu lực và thuộc một weekday của rule.
- Upsert dùng version/idempotency; xóa exception làm worker khôi phục kết quả từ
  rule nếu intent tương ứng vẫn private.

### 4.4. TravelIntent

Collection `travel_intents`:

| Field                                       | Ý nghĩa                                        |
| ------------------------------------------- | ---------------------------------------------- |
| `id`, `ownerUserId`                         | Chủ nhu cầu                                    |
| `sourceType`, `scheduleId`, `sourceVersion` | `SCHEDULE` hoặc `MANUAL`, snapshot nguồn       |
| `localDate`, `direction`                    | Khóa ngày/chiều theo lịch                      |
| `travelRole`                                | `RIDER`, `DRIVER`, `UNKNOWN`                   |
| `origin`, `destination`                     | Snapshot exact, luôn private trong Stage 7     |
| `earliestDepartureAt`, `arrivalDeadlineAt`  | Instant UTC; field không áp dụng là nullable   |
| `commitmentState`                           | `PRIVATE`, `PUBLISHED`, `BOOKED`, `CANCELLED`  |
| `sourceChanged`                             | Cảnh báo schedule đã đổi nhưng snapshot bị giữ |
| `version`, timestamps                       | Concurrency/audit                              |

Unique partial index `(scheduleId, localDate, direction)` cho source `SCHEDULE`.
Manual intent dùng `Idempotency-Key`. OUTBOUND đi từ origin tới activity place,
deadline bằng start trừ buffer. RETURN đi từ activity place về origin, earliest
departure bằng end. Chỉ sinh direction được bật.

Khi sửa rule/exception, worker cập nhật hoặc xóa intent tương lai chỉ khi
`PRIVATE`. `PUBLISHED`/`BOOKED` giữ snapshot và được đánh `sourceChanged=true`.
Không cascade làm thay đổi một cam kết đã công bố.

### 4.5. RouteSnapshot và ContributionEstimate

`RouteSnapshot` thuộc planning, lưu provider, vehicle mode, origin/destination
snapshot, distance mét, duration giây, GeoJSON `LineString`, provider route ID
nếu có, thời điểm tính và expiry. Không lưu API key hoặc raw response.

`ContributionEstimate` là response có `estimateId`, `routeSnapshotId`,
`sharedDistanceMeters`, `suggestedPerKmVnd`, `amountVnd`, `calculatedAt` và
`expiresAt`. Tiền là số nguyên VND, làm tròn đến 1.000 VND gần nhất bằng policy
server. Nó không giữ chỗ, không phải giá thanh toán và không được Stage 10 tái sử
dụng sau expiry mà không tính lại.

Công thức:

```text
suggestedPerKm = fuelPriceVndPerLiter * litersPer100Km / 100 / (passengerSeats + 1)
amount = sharedDistanceKm * selectedSuggestedPerKm
```

Local/test có cấu hình demo gắn nhãn. Staging/production phải được cấp
`fuelPrice`, mức tiêu thụ theo loại xe và min/max contribution; thiếu cấu hình
thì fail startup, không tự dùng giá local.

## 5. Materializer, xung đột và quyền riêng tư

- Worker chạy theo lease phân tán, quét rolling horizon `[today, today+13]` theo
  `Asia/Ho_Chi_Minh`; chạy lại an toàn nhờ unique key và conditional update.
- Job chạy ngay khi worker start, theo lịch cấu hình và nhận outbox signal sau
  khi rule/exception thay đổi. Signal trùng không tạo intent trùng.
- Clock injectable; chuyển local date/time sang `ZonedDateTime` rồi mới sang
  `Instant`. Không cộng offset thủ công.
- Xung đột được tính từ interval hoạt động start/end sau exception. Các interval
  giao nhau được trả như warning có schedule/date liên quan; save vẫn thành công,
  không tự merge hoặc tự chọn lịch.
- Pause giữ rule/exceptions nhưng hủy intent tương lai còn private. Resume sinh
  lại trong horizon. End đặt ngày kết thúc hiệu lực và xử lý tương tự.
- Owner CRUD yêu cầu `VERIFIED_MEMBER`; lịch có role DRIVER còn yêu cầu
  `APPROVED_DRIVER` tại thời điểm ghi. Revocation ngăn mutation mới nhưng không
  xóa audit/snapshot lịch sử.
- Friend read gọi `SocialAccessPolicy` trên mỗi request. Unfriend, block hoặc đổi
  visibility có hiệu lực ở lần đọc tiếp theo. Response `no-store`; không cache
  projection dùng chung giữa viewer.

Friend projection chỉ gồm ngày, khoảng giờ, direction, role, activity category
và public area. Không trả tên lịch riêng, môn/lớp/phòng, exact label, home origin,
place ID, tọa độ, route geometry hoặc contribution.

## 6. Goong adapter và chính sách lỗi

Backend gọi REST API Goong qua `RoutingProvider`; web không gọi Goong REST trực
tiếp. Contract adapter dùng:

- Place AutoComplete để tìm gợi ý.
- Place Detail để resolve một lựa chọn thành tọa độ.
- Direction với `vehicle=bike|car` để lấy route, distance, duration và overview
  polyline; adapter decode thành GeoJSON `LineString`.
- Mỗi phiên autocomplete có UUID v4, tối đa một detail lookup. Token hết hạn sau
  5 phút và không dùng lại giữa người dùng.

Cấu hình bắt buộc ngoài test:

| Biến                           | Chính sách                                                            |
| ------------------------------ | --------------------------------------------------------------------- |
| `DIKE_ROUTING_PROVIDER`        | `goong`; hosted từ chối `fake`                                        |
| `DIKE_GOONG_API_KEY`           | Secret server-side, không được blank/local placeholder                |
| `DIKE_GOONG_BASE_URL`          | Mặc định `https://rsapi.goong.io`; hosted chỉ HTTPS và allowlist host |
| `DIKE_ROUTING_CONNECT_TIMEOUT` | Mặc định 2 giây                                                       |
| `DIKE_ROUTING_REQUEST_TIMEOUT` | Mặc định 5 giây                                                       |
| `DIKE_ROUTING_CACHE_TTL`       | Mặc định 10 phút                                                      |
| `DIKE_ROUTE_ESTIMATE_TTL`      | Mặc định 15 phút                                                      |

Direction/detail cache trong Redis dùng hash HMAC của request chuẩn hóa, không
đặt query địa điểm hoặc tọa độ trong key/log. Autocomplete không dùng shared
cache vì gắn session token và nội dung tìm kiếm nhạy cảm. Cache miss mới gọi
provider; cache failure bỏ cache nhưng vẫn gọi provider. Không phục vụ stale
route sau provider failure.

Chỉ retry một lần có jitter cho timeout trước response, `429` và `5xx`; không
retry lỗi validation/`4xx` khác. Circuit breaker mở ngắn hạn sau lỗi liên tiếp.
Map lỗi ổn định: `PLACE_NOT_FOUND`, `ROUTE_NOT_FOUND`, `ROUTING_TIMEOUT`,
`ROUTING_RATE_LIMITED`, `ROUTING_UNAVAILABLE`, `ESTIMATE_EXPIRED`. Không trả raw
provider body. Metric phân biệt timeout/quota/error/cache hit nhưng không gắn
email, query hay tọa độ làm label.

## 7. REST/OpenAPI contract

Tất cả endpoint dưới `/api/v1`, dùng session cookie, CSRF/origin cho mutation và
`Cache-Control: no-store` cho dữ liệu riêng tư.

### Schedule và intent

| Method   | Endpoint                            | Hành vi                                       |
| -------- | ----------------------------------- | --------------------------------------------- |
| `POST`   | `/schedules`                        | Tạo rule; trả warnings xung đột               |
| `GET`    | `/schedules`                        | Danh sách owner, lọc status/range             |
| `GET`    | `/schedules/{id}`                   | Chi tiết owner                                |
| `PUT`    | `/schedules/{id}`                   | Replace có `version`; phát materialize signal |
| `DELETE` | `/schedules/{id}`                   | End, không hard-delete audit/history          |
| `POST`   | `/schedules/{id}/pause`             | Pause idempotent                              |
| `POST`   | `/schedules/{id}/resume`            | Resume và materialize lại                     |
| `PUT`    | `/schedules/{id}/exceptions/{date}` | Upsert SKIP/OVERRIDE                          |
| `DELETE` | `/schedules/{id}/exceptions/{date}` | Gỡ exception                                  |
| `GET`    | `/schedules/{id}/conflicts`         | Warning trong khoảng ngày                     |
| `GET`    | `/schedules/friends`                | Projection an toàn theo viewer/range/cursor   |
| `GET`    | `/travel-intents`                   | Owner xem intents theo range/state            |
| `GET`    | `/travel-intents/{id}`              | Owner xem snapshot                            |
| `POST`   | `/travel-intents`                   | Tạo manual intent với idempotency             |
| `PUT`    | `/travel-intents/{id}`              | Sửa intent private manual                     |
| `DELETE` | `/travel-intents/{id}`              | Cancel intent private                         |

Mutation dùng `If-Match`/version và trả `409 VERSION_CONFLICT` khi stale. Range
tối đa 31 ngày; cursor opaque; page mặc định 20, tối đa 50.

### Places, route và estimate

| Method | Endpoint                  | Hành vi                                              |
| ------ | ------------------------- | ---------------------------------------------------- |
| `POST` | `/routing/place-sessions` | Tạo autocomplete session token opaque                |
| `GET`  | `/routing/places`         | Tìm tối đa 10 gợi ý theo query/session/bias tùy chọn |
| `POST` | `/routing/places/resolve` | Resolve một `placeRef` thành `PlaceSnapshot`         |
| `POST` | `/routing/routes`         | Tính và lưu route snapshot owner-scoped              |
| `POST` | `/routing/estimates`      | Tính contribution estimate từ route snapshot         |
| `GET`  | `/routing/routes/{id}`    | Owner đọc snapshot còn retention                     |

`placeRef` là opaque với client; adapter chịu trách nhiệm chuyển sang provider
place ID. Request route nhận `vehicleMode=MOTORBIKE|CAR`; adapter map sang Goong
`bike|car`. Response có geometry đủ để vẽ SVG nhưng không có provider key/raw
payload. OpenAPI sinh operation client; web không tự định nghĩa lại DTO hay ghép
backend URL.

## 8. Web UX — không có bản đồ tương tác

- `/schedules`: agenda 14 ngày, danh sách rule, trạng thái và warnings.
- `/schedules/new` và `/schedules/{id}/edit`: weekday/date/time, direction,
  buffer, role, visibility và hai bộ chọn địa điểm.
- Place picker debounce, hủy request cũ, hỗ trợ keyboard/screen reader, hiển thị
  main/secondary text và yêu cầu người dùng chọn suggestion đã resolve; không
  nhận text tự do như một địa điểm hợp lệ.
- Route preview hiển thị điểm đi/đến, distance, ETA, SVG polyline đơn sắc, expiry
  và estimate VND có nhãn “ước tính”. Không có map tile, pan/zoom hay kéo marker.
- Exception editor cho skip/override; conflict panel không chặn save.
- Friends calendar chỉ render projection server trả về; client không tải exact
  data rồi tự ẩn.
- Driver role với evidence `SIMULATED` hiển thị “Tài xế thử nghiệm”. Không dùng
  từ “đã eKYC”, “đã duyệt” hoặc badge production.
- TanStack Query key luôn gồm viewer/range; xóa cache lịch bạn bè khi revision xã
  hội đổi, logout, 401, unfriend hoặc block.

## 9. Work breakdown

| ID     | Công việc                                                                       | Dependency                | Gate                                       |
| ------ | ------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------ |
| S78-00 | Đồng bộ master, ADR 0015, dependency matrix, issue/milestone và baseline checks | Stage 6                   | Quyết định không mâu thuẫn                 |
| S78-01 | Simulated driver approval local/test, evidence API và hosted guard              | S78-00                    | Không ghi role; negative startup test xanh |
| S78-02 | Schedule domain, Mongo documents, indexes và repository                         | S78-00                    | Validation/concurrency/unique test xanh    |
| S78-03 | Goong properties, HTTP adapter, fake/stub và error mapping                      | S78-00                    | Contract test với fixture đã sanitize      |
| S78-04 | Place session, autocomplete, resolve, rate limit và privacy                     | S78-03                    | Key/token/query không lọt log              |
| S78-05 | Schedule CRUD, pause/end, exception và conflict use cases                       | S78-02, S78-04            | API/module tests xanh                      |
| S78-06 | TravelIntent materializer, lease, outbox signal và reconciliation               | S78-05                    | Retry/concurrency không trùng              |
| S78-07 | Route snapshot, cache, geometry và contribution estimate                        | S78-03, S78-04            | Timeout/quota/expiry test xanh             |
| S78-08 | Friend projection và revocation integration với Stage 6                         | S78-05, S78-06            | Không rò exact location                    |
| S78-09 | OpenAPI, generated TypeScript operations và stale-client CI gate                | S78-05–08                 | `pnpm api:check` xanh                      |
| S78-10 | Web schedule/exception/conflict UI và accessibility                             | S78-09                    | Component/axe tests xanh                   |
| S78-11 | Web place picker, route SVG và estimate UX                                      | S78-07, S78-09            | Không có key/token trong browser logs      |
| S78-12 | Integration/E2E, observability, runbook và failure drills                       | S78-10, S78-11            | Full gate xanh                             |
| S78-13 | Staging Goong smoke, privacy review và handoff Stage 9/10                       | S78-12, Stage 5 cho pilot | Evidence không chứa PII/secret             |

Khuyến nghị chia PR đúng theo lát trên. Không gộp domain, provider, worker và UI
thành một PR lớn. Mỗi PR cập nhật OpenAPI/test/doc liên quan trong cùng thay đổi.

## 10. Test plan

### Unit/domain

- Validate date range, weekday, same-day time, zone, buffer, directions và role.
- OUTBOUND/RETURN tạo đúng origin/destination và instant UTC.
- Exception kế thừa đúng field; SKIP không sinh intent.
- Overlap trả warning nhưng không merge/block.
- Contribution dùng decimal/rounding xác định, không dùng floating-point tiền.
- Friend projection không có exact/private field kể cả khi field mới được thêm.

### Integration/concurrency

- Mongo replica set chứng minh rule + outbox atomic và rollback.
- Hai worker materialize cùng schedule chỉ có một intent/key.
- Edit/pause/resume/exception cập nhật private intent; published/booked bất biến và
  được đánh `sourceChanged`.
- Unfriend/block/privacy change thu hồi lần đọc tiếp theo và không trả cache cũ.
- Redis cache hit/miss/TTL/failure; cache key không chứa raw query/coordinate.
- Goong stub kiểm request encoding, `bike|car`, polyline decode, empty route,
  malformed response, timeout, 429 và 5xx retry budget.
- Verified local user có quyền tài xế `SIMULATED`; tắt flag mất quyền; hosted bật
  flag không khởi động.

### API/security

- Owner isolation/IDOR cho mọi schedule, exception, intent và route ID.
- CSRF/origin, optimistic version, idempotency, range/page limit và validation.
- Friend không nhận full address, coordinate, place ID, geometry hoặc tên riêng.
- Goong key, request query, exact coordinate và provider raw error không xuất hiện
  trong log, OpenAPI example, CI artifact hoặc browser bundle.
- Không có endpoint bypass role, approve giả hoặc fake routing trong hosted source
  path/configuration.

### Web/E2E

- Tạo lịch hai chiều → worker tạo hai intent/ngày trong 14 ngày.
- Skip/override/pause/resume và conflict warning hoạt động qua UI.
- Autocomplete → resolve → route → SVG preview → estimate; expiry yêu cầu tính lại.
- Hai browser là bạn xem được projection; unfriend/block làm dữ liệu biến mất.
- Keyboard, focus, label, error/loading/empty/offline và mobile viewport đạt.
- UI ghi rõ tài xế thử nghiệm và không mô tả là đã eKYC.

### Provider smoke

- Chạy một smoke test Goong thật cho autocomplete, detail, `bike` và `car` ở
  staging/local được kiểm soát.
- Evidence chỉ giữ status, latency, distance/duration giả lập; không lưu API key,
  query cá nhân, tọa độ nhà hoặc raw response.

## 11. Acceptance gate

- `pnpm check`, `pnpm api:check` và `./mvnw -B -ntp verify` xanh.
- OpenAPI/generated client đồng bộ; module/ArchUnit verification xanh.
- Lịch, ngoại lệ, conflict, pause/end và materialization 14 ngày chạy E2E.
- Worker retry/concurrency không tạo duplicate; edit không sửa cam kết đã publish.
- Goong real smoke đạt; timeout/quota không có straight-line fallback.
- Place/route cache, route snapshot và estimate expiry hoạt động đúng.
- Friend projection và revocation test chứng minh không lộ vị trí.
- Simulated driver chỉ local/test, có nhãn/evidence, không ghi Mongo và hosted
  fail-fast nếu bật.
- Không có map key hoặc Goong REST key trong frontend. UI chưa tuyên bố có bản đồ
  tương tác hoặc navigation.
- Stage 5 được ghi rõ là deferred; Stage 7–8 không được dùng để vượt gate eKYC
  của production pilot.

## 12. Handoff

- Stage 9 nhận immutable `TravelIntent`/projection để tạo bài đăng, không đọc
  schedule repository.
- Stage 10 nhận `RouteSnapshot` và tính lại contribution để tạo
  `ContributionQuote` bền vững; không biến estimate hết hạn thành quote.
- Stage 11 dùng snapshot/quote của ride cho booking consistency.
- Khi Stage 5 tiếp tục, workflow thật ghi `assignedRoles=APPROVED_DRIVER`, tăng
  `authorizationVersion` và thu hồi mọi quyền mô phỏng trước staging/pilot.

## 13. Tài liệu provider tham chiếu

- [Goong Directions API](https://document.goong.io/tutorial-Direction.html)
- [Goong Places API](https://document.goong.io/tutorial-Places.html)
- [Goong API key và session token](https://document.goong.io/tutorial-Help.html)

Tài liệu provider có thể thay đổi; khi bắt đầu S78-03 phải kiểm tra lại endpoint,
vehicle mode, quota, điều khoản cache và cách quản lý key thay vì dựa duy nhất vào
bản runbook này.
