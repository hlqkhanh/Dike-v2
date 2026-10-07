# STAGE 13 — Đi ngay, presence và hành trình trực tiếp

Ngày lập: 07/10/2026. Baseline: `8a902f6` trên `main`.
Trạng thái: Đặc tả chuyên sâu thuộc batch hợp nhất Stage 12–14; không triển khai/nghiệm thu độc lập.

Runbook thực thi chính: [STAGE_12_13_14.md](STAGE_12_13_14.md). Đọc cùng
[PLAN_MASTER](PLAN_MASTER.md), [Stage 11](STAGE_11.md) và [Stage 12](STAGE_12.md).

## 1. Mục tiêu, phạm vi và gate

Stage 13 cho phép driver chủ động bật “Sẵn sàng đi ngay”, passenger tìm candidate, gửi proposal
60 giây và theo dõi vị trí theo consent sau booking. Không tạo auto-dispatch hoặc booking path mới.

### Trong phạm vi

- Availability session tạm thời trên Redis.
- Heartbeat 15 giây; ẩn khỏi search sau 45 giây; TTL cleanup.
- Instant candidate search theo intent/route server-owned.
- Instant proposal vẫn dùng Proposal/Booking và acceptance transaction Stage 11.
- Vị trí trước booking được làm mờ phía server, bán kính mặc định 500 m.
- Exact live location chỉ sau booking và explicit consent từng participant.
- Exact latest location Redis TTL 120 giây, không lưu GPS history.
- REST command cho heartbeat/location; STOMP user queue cho delivery.
- Web foreground map, reconnect/reconciliation và manual location fallback.

### Ngoài phạm vi

- Auto-dispatch, auto-accept hoặc nhận thêm passenger sau trip start.
- Background GPS trên web; mobile background location thuộc Stage 16.
- GPS route history, replay, analytics heatmap hoặc emergency monitoring.
- Public exact driver location trước booking.
- Hủy booking tự động do mất heartbeat/socket.

### Gate đầu vào

| Gate   | Yêu cầu                                                                  |
| ------ | ------------------------------------------------------------------------ |
| G13-01 | Stage 8 có route/quote/server-owned point và provider failure policy     |
| G13-02 | Stage 10/11 có Trip, Proposal, Booking, capacity và state transitions    |
| G13-03 | Stage 12 ticket, Redis bridge, user queue và reconnect contract xanh     |
| G13-04 | Stage 6 block/account policy và Stage 5 driver eligibility authoritative |
| G13-05 | Redis không dùng chung namespace giữa environment                        |

## 2. Quyết định đã khóa

- Client gửi heartbeat/location bằng REST qua session, CSRF và Origin validation.
- STOMP chỉ chuyển server event; không nhận `/app/location.update` trong v1.
- Heartbeat mỗi 15 giây; session không còn searchable khi age lớn hơn 45 giây.
- Availability Redis key TTL 60 giây; live location TTL 120 giây.
- Location trên 45 giây có `stale=true`, không trình bày như hiện tại.
- Pre-booking response chỉ trả cell center đã làm mờ và `accuracyRadiusMeters=500`.
- Exact coordinate không đi vào outbox, log, metric label, notification hoặc public topic.
- Mỗi participant tự bật/tắt consent; booking terminal revoke ngay.
- Mất network/socket/heartbeat không hủy proposal đã accept hoặc booking.
- Reconnect luôn refetch REST trước khi cho phép thao tác tiếp.

Tạo ADR live-location/privacy/retention và cập nhật master/ADR realtime tương ứng.

## 3. Ownership và dữ liệu availability

`ride` sở hữu availability, instant proposal mode, consent và latest-location authorization.
`messaging` cung cấp public realtime publisher; không đọc repository ride. `planning/routing` cung cấp
public port để resolve intent, route, place và quote server-owned.

Availability là ephemeral record trên Redis:

```text
handle
driverId
tripId
tripVersion
state: READY
enabledAt
lastHeartbeatAt
expiresAt
lastExactLocation
lastLocationAt
locationSource: GPS | MANUAL_PLACE
liveTrackingAvailable
```

Redis layout:

- `availability:{environment}:{driverId}` TTL 60 giây.
- GEO index theo environment để prefilter khoảng cách.
- ZSET expiry chứa handle/expiry.
- Atomic script cập nhật session, GEO và expiry.
- Cleanup worker loại member GEO/ZSET hết hạn; query vẫn recheck per-session key và heartbeat age.

Không dùng GEO membership đơn lẻ làm bằng chứng user còn online. Ghost member không được trả nếu
session key mất hoặc heartbeat quá 45 giây.

### Eligibility bật availability

- Account `ACTIVE`, có `APPROVED_DRIVER` theo server evidence.
- Trip thuộc driver, status `OPEN`, còn chỗ và route/destination hợp lệ.
- Departure trong `[serverNow, serverNow + 15 phút]`.
- Trip chưa start/cancel/expire.
- Driver chỉ có một availability active.
- Nếu dùng manual point, point phải là server-owned place/route point.

Availability bị tắt khi driver tắt, heartbeat hết hạn, trip full/start/cancel/complete/expire hoặc
account bị khóa. Việc tắt availability không sửa booking đã tồn tại.

## 4. Vị trí làm mờ trước booking

Server dùng exact coordinate nội bộ để GEO/routing nhưng projection trả:

```json
{
  "areaCenter": { "latitude": 21.0, "longitude": 105.8 },
  "accuracyRadiusMeters": 500,
  "updatedAt": "...",
  "stale": false,
  "liveTrackingAvailable": true
}
```

Quy tắc:

- Coordinate được quy vào cell cấu hình khoảng 500 m tại backend.
- Không trả exact coordinate ẩn trong field khác, source map hoặc analytics event.
- Candidate response không chứa address hiện tại của driver.
- Trên 45 giây: không render marker như live; có thể giữ card với nhãn stale nếu policy cho phép.
- Driver không có location mới vẫn có thể xuất hiện theo route/trip, nhưng
  `liveTrackingAvailable=false`.
- Search response `Cache-Control: no-store` và cursor viewer/query scoped.

## 5. Instant search và proposal

Passenger chọn pickup/destination và tạo/lấy `TravelIntent`/route snapshot bằng Stage 7/8. Search
API nhận ID server-owned, không đưa exact coordinate vào URL/query string.

Pipeline:

1. Load intent, route và actor eligibility.
2. GEO prefilter active availability quanh pickup/hành lang.
3. Recheck heartbeat, trip status, seat, block, community và vehicle.
4. Tối đa 20 candidate đi qua detailed route insertion/ETA/detour.
5. Rank friend hợp lệ trước, rồi detour/ETA/time/community/rating đúng role và stable ID.
6. Trả card + blurred marker; không khẳng định phù hợp nếu routing provider thiếu dữ liệu.

Mở rộng Proposal:

```text
mode: SCHEDULED | INSTANT
availabilityHandle       // chỉ INSTANT
expiresAt                // INSTANT = createdAt + 60 giây
```

Instant proposal không bắt buộc public ride post nhưng vẫn có `intentId`, `tripId`, immutable quote
và participants. API riêng điều phối vào cùng use case/transaction Proposal Stage 11; không tạo
booking trực tiếp.

Acceptance recheck:

- Server time chưa tới expiry.
- Proposal/version/quote/terms còn đúng.
- Trip chưa start, còn seat và candidate participants hợp lệ.
- Block/membership/schedule conflict/vehicle approval vẫn đạt.
- Atomic accept tạo đúng một Booking và vô hiệu proposal xung đột.

Availability mất heartbeat sau khi gửi không tự expire proposal trước mốc 60 giây; trip/seat/policy
vẫn được recheck khi accept. Trip còn chỗ có thể tiếp tục ready; full/start phải tắt.

## 6. Live location sau booking

Mongo `live_location_consents`:

```text
bookingId
userId
enabledAt
disabledAt
revokedAt
version
```

Unique `(bookingId, userId)`. Migration `V013_0__live_location_consents`.

Latest exact location chỉ nằm Redis:

```text
live-location:{environment}:{bookingId}:{userId}
latitude
longitude
accuracyMeters
source: GPS | MANUAL_PLACE
serverReceivedAt
clientLocationId
```

TTL 120 giây.

### Authorization matrix

- Driver exact location chỉ gửi tới passenger của đúng booking.
- Passenger exact location chỉ gửi tới driver.
- Passenger khác cùng trip không thấy nhau.
- Chỉ participant booking active mới bật consent hoặc gửi location.
- Sender consent không suy ra recipient consent; mỗi người điều khiển location của mình.
- Booking terminal revoke consent, xóa Redis key và phát invalidation không chứa coordinate.
- Block không thu hồi contact/location cần thiết của booking active.
- Locked-account safety mode chỉ cho location khi booking `BOARDED` hoặc `IN_PROGRESS`.

### Rate, dedupe và freshness

- Browser chỉ gửi khi tab foreground và location thay đổi đáng kể.
- Tối đa một accepted location/5 giây/user/booking.
- `clientLocationId` UUID; retry cùng ID trả kết quả cũ và không tính rate mới.
- Timestamp hiển thị lấy từ server; client timestamp không kéo dài freshness.
- Trên 45 giây: stale. Trên 120 giây: API trả không có current location.
- Validate latitude/longitude range, finite values, accuracy và payload size.

## 7. Public REST contract

| Method | Endpoint                                      | Chức năng                        |
| ------ | --------------------------------------------- | -------------------------------- |
| GET    | `/api/v1/availability/me`                     | Availability hiện tại            |
| PUT    | `/api/v1/availability/me`                     | Bật ready cho trip               |
| DELETE | `/api/v1/availability/me`                     | Tắt ready                        |
| POST   | `/api/v1/availability/me/heartbeat`           | Gia hạn heartbeat                |
| PUT    | `/api/v1/availability/me/location`            | GPS/manual availability location |
| POST   | `/api/v1/availability/search`                 | Search theo intent server-owned  |
| POST   | `/api/v1/availability/{handle}/proposals`     | Gửi instant proposal 60 giây     |
| GET    | `/api/v1/bookings/{id}/live-location`         | Latest authorized locations      |
| PUT    | `/api/v1/bookings/{id}/live-location-consent` | Bật consent actor                |
| DELETE | `/api/v1/bookings/{id}/live-location-consent` | Tắt consent actor                |
| PUT    | `/api/v1/bookings/{id}/live-location`         | Gửi exact location               |

GPS request:

```json
{
  "clientLocationId": "uuid",
  "source": "GPS",
  "latitude": 21.0,
  "longitude": 105.8,
  "accuracyMeters": 20
}
```

Manual request dùng server-owned `placeId`/route-point ID, không tin label client.

Error codes:

- `AVAILABILITY_NOT_ELIGIBLE`, `AVAILABILITY_EXPIRED`, `AVAILABILITY_ALREADY_ACTIVE`.
- `HEARTBEAT_RATE_LIMITED`.
- `LOCATION_INVALID`, `LOCATION_RATE_LIMITED`, `LOCATION_CONSENT_REQUIRED`.
- `LOCATION_NOT_AVAILABLE`, `LOCATION_STALE`.
- `INSTANT_REQUEST_EXPIRED`, `TRIP_NO_LONGER_AVAILABLE`.

`429` có `Retry-After`. Location/search responses luôn `no-store`.

## 8. Realtime contract

Non-sensitive events:

```text
availability.updated
proposal.created / proposal.updated
booking.updated
trip.updated
```

Exact `location.updated` chỉ phát tới `/user/queue/bookings` sau khi recheck booking, sender consent,
recipient và rate. Không dùng shared trip topic cho coordinate.

Outbox `location.updated` nếu cần reconciliation chỉ chứa booking/user ID, revision, `updatedAt` và
`staleAt`; exact coordinate đi qua Redis payload target-specific và không được persist trong outbox.

Reconnect sequence:

1. Kiểm tra REST session.
2. Lấy realtime ticket mới và reconnect.
3. Refetch availability, proposal, booking, trip và latest permitted locations.
4. Chỉ sau reconciliation mới enable action controls.

Mất socket/tab background không cancel accepted booking.

## 9. Web implementation

### Driver

1. Chọn trip eligible và bật ready.
2. Chọn GPS hoặc điểm thủ công.
3. Gửi heartbeat trong foreground.
4. Nhận instant proposal và accept/reject bằng API Stage 11.
5. Sau booking, bật/tắt live-location consent.
6. Thực hiện arrived, boarded, start, complete bằng server transition.

### Passenger

1. Chọn pickup/destination và tạo intent/quote.
2. Search candidate trên map/list.
3. Chỉ thấy blurred marker, ETA, seat và update time.
4. Chọn candidate và gửi proposal 60 giây.
5. Sau accept, có thể bật location của mình và xem driver nếu driver consent.

UI phải có state cho GPS denied, HTTPS unavailable, tab hidden, heartbeat expired, stale location,
routing failure, candidate full/start, proposal timeout và reconnect. Coordinate không lưu vào
local storage, persisted query cache, URL hoặc analytics.

## 10. Work breakdown

| ID     | Deliverable                       | Hoàn thành khi                                      |
| ------ | --------------------------------- | --------------------------------------------------- |
| S13-00 | Preflight, plan, ADR, master sync | Privacy/transport/lifetime không mâu thuẫn          |
| S13-01 | Redis availability/GEO/expiry     | Không ghost candidate, TTL/cleanup idempotent       |
| S13-02 | Enable/disable/heartbeat          | Eligibility và 15/45 giây đúng server clock         |
| S13-03 | Blur/search/ranking               | Browser không nhận exact pre-booking coordinate     |
| S13-04 | Instant proposal mode             | 60 giây, same booking transaction, no auto-dispatch |
| S13-05 | Consent + exact Redis location    | Unique consent, TTL 120 và terminal revoke          |
| S13-06 | Location REST/dedupe/rate         | 5 giây, UUID retry và server timestamp đúng         |
| S13-07 | Realtime user delivery            | Không leak passenger/location qua topic             |
| S13-08 | OpenAPI/client                    | Client generated và contract stale check xanh       |
| S13-09 | Foreground web UI                 | Hai client chạy ready → proposal → journey          |
| S13-10 | Security/E2E/load                 | Heartbeat loss/reconnect/privacy/race đạt           |
| S13-11 | Metrics/runbook/rollout           | Có cleanup/recovery/kill switch/evidence            |

## 11. Test matrix và acceptance

### Time/state

- Heartbeat 15 giây duy trì session; age >45 giây biến khỏi result; TTL dọn sau 60 giây.
- Location >45 giây stale; >120 giây không còn current.
- Instant proposal accept trước/sau đúng boundary 60 giây.
- Full/start/cancel/lock tắt availability đúng lúc.

### Privacy/security

- Pre-booking API/browser/source map/cache không chứa exact coordinate.
- Outsider, passenger khác và wrong booking không đọc location.
- Không consent không gửi/đọc exact location.
- Terminal booking revoke ngay cả khi worker/socket chậm.
- Không coordinate trong log, metric label, notification, outbox hoặc test artifact.
- Fake client không sửa driverId, timestamp, trip state hoặc candidate eligibility.

### Concurrency/resilience

- Hai passenger tranh ghế cuối vẫn giữ invariant Stage 11.
- Retry location cùng ID không lặp/rate sai; khác ID trong 5 giây bị limit.
- GEO ghost được query-time check và cleanup.
- Redis restart làm mất availability/location an toàn nhưng không mất booking.
- Mất heartbeat/socket/tab background không cancel booking.
- Reconnect refetch REST trước action và không tạo duplicate proposal.

### Gate cuối

- Multi-browser E2E chạy ready → search → proposal → booking → location → complete.
- Testcontainers Mongo/Redis, privacy contract và load 100 connections xanh.
- `pnpm check`, `pnpm api:check`, `mvnw verify` xanh.
- OpenAPI/client/docs/runbook/metrics và evidence gắn SHA.
