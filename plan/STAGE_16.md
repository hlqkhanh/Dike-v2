# STAGE 16 — React Native + Expo mobile

Ngày lập: 08/10/2026. Baseline: `0c69bf2` trên `main`, sau khi Stage 15 hoàn tất.

## 1. Mục tiêu

Xây một ứng dụng React Native + Expo + TypeScript cho Android và iOS, dùng chung
Spring Boot backend, OpenAPI và quy tắc phân quyền với web. Mobile phải hoàn thành
luồng đăng nhập, tìm chuyến, proposal/booking, hành trình trực tiếp, thanh toán ngoài
nền tảng và đánh giá.

Stage này không tạo backend riêng, không dùng WebView thay ứng dụng native và không
tái sử dụng React DOM component. Design token, domain type và generated API contract
được chia sẻ theo ADR 0021, thay thế quyết định native thuần tại ADR 0020.

## 2. Phạm vi

Trong phạm vi:

- `apps/mobile` bằng React Native, Expo và TypeScript.
- Expo Development Build cho phát triển/tích hợp; EAS Build tạo Android/iOS artifact.
- Tái sử dụng `packages/api-client-ts` sinh từ `docs/api/openapi.json`.
- Google native login, đổi Google identity token lấy opaque mobile session.
- Secure storage, logout, revoke session và xử lý account bị khóa.
- Onboarding, profile, verification status và simulated access local/test.
- Feed/search/map, trip, proposal, booking và active journey.
- Chat, notification, STOMP reconnect và push notification qua FCM/APNs.
- Deep link có kiểm tra authentication và authorization lại từ server.
- Offline read state có giới hạn và queue mutation idempotent.
- Foreground/background location chỉ trong active booking, có explicit consent.
- Accessibility, localization tiếng Việt, telemetry không chứa dữ liệu nhạy cảm.
- CI, integration test, Android/iOS E2E và kiểm thử trên thiết bị thật.

Ngoài phạm vi:

- Backend hoặc database riêng cho mobile.
- Ví, thanh toán trong ứng dụng hoặc thu tiền qua nền tảng.
- Theo dõi vị trí khi không có active booking.
- Đồng bộ toàn bộ dữ liệu người dùng để sử dụng offline.
- Group chat, gọi thoại/video và upload tệp trong chat.
- Phát hành public store; quy trình store production thuộc Stage 17.

## 3. Điều kiện đầu vào

| Gate   | Điều kiện                                                           | Bằng chứng                                               |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------- |
| G16-01 | Stage 15 và API Stage 2–14 ổn định                                  | `pnpm check`, `pnpm api:check`, Maven `verify` xanh      |
| G16-02 | OpenAPI mô tả đủ auth, feed, trip, booking, chat, journey và review | Contract audit không cần DTO viết tay                    |
| G16-03 | Mobile session contract được threat-model                           | TTL, rotate, revoke, device metadata và logout được chốt |
| G16-04 | Realtime ticket/STOMP authorize từng destination                    | Test reconnect và block/revoke đạt                       |
| G16-05 | Push worker port và notification event đã có                        | Fake adapter local/test chạy được                        |
| G16-06 | Location API chỉ nhận dữ liệu cho booking hợp lệ                    | Server kiểm tra participant, consent, state và freshness |
| G16-07 | Có thiết bị Android và iOS thật                                     | Ghi model, OS, build và kết quả test                     |

Không bắt đầu background location trước khi G16-03, G16-04 và G16-06 đạt.

## 4. Kiến trúc và cấu trúc source

```text
apps/mobile/
  app/                   # Expo Router routes và layouts
  src/
    core/                # network, auth, storage, realtime, telemetry
    features/            # auth, feed, trips, bookings, journey, chat, review
    components/          # React Native components; không import React DOM
  assets/
  test/
  app.config.ts
  eas.json

packages/api-client-ts/  # OpenAPI generated, dùng chung web/mobile; không sửa tay
```

Quy tắc dependency:

- Feature phụ thuộc application ports trong `core`, không gọi HTTP trực tiếp từ widget.
- Generated client không phụ thuộc UI hoặc secure storage.
- Router chỉ nhận ID từ deep link; dữ liệu và quyền luôn tải lại từ backend.
- Server state có một cache owner; widget không sao chép domain object sang nhiều store.
- Secret/session không ghi vào log, analytics, crash breadcrumb hoặc plain preferences.

Expo platform baseline:

- Expo Router cho navigation và deep link.
- Expo SecureStore cho opaque mobile credential.
- Expo Notifications cho permission/token/notification handling; backend vẫn gửi qua
  provider adapter và payload luôn được redact.
- Expo Location + TaskManager cho location foreground/background có kiểm soát.
- Development Build chứa native modules cần thiết; Expo Go chỉ dùng cho UI không phụ
  thuộc native integration và không được dùng làm bằng chứng nghiệm thu.
- EAS Build dùng profile `development`, `preview` và `production`; Stage 16 chỉ yêu
  cầu development/preview, production signing và store submission thuộc Stage 17.

## 5. Public contract cần chốt

### 5.1. Mobile authentication

Backend cần một flow riêng cho native client:

1. Expo Development Build dùng Google native authentication nhận identity token/authorization code.
2. App gửi credential tới endpoint exchange qua HTTPS.
3. Backend xác minh issuer, audience, nonce và trạng thái account.
4. Backend trả opaque access token và metadata phiên; client không tự suy ra authority.
5. Token lưu bằng Keychain/Android Keystore qua secure storage.

Contract phải định nghĩa TTL, refresh/rotation hoặc re-authentication, revoke một thiết
bị, revoke mọi thiết bị, logout idempotent và hành vi khi token hết hạn. Không tái sử
dụng cookie/CSRF flow của browser cho mobile.

### 5.2. Push registration

- Device installation có ID ngẫu nhiên, platform, app version và push token.
- Đăng ký/rotate/xóa token là command idempotent.
- Một token không được thuộc đồng thời nhiều account.
- Payload push chỉ chứa loại sự kiện và opaque resource ID; không chứa chat, địa chỉ,
  tọa độ hoặc thông tin xác minh.
- Mở notification phải gọi API và authorize lại trước khi hiển thị tài nguyên.

### 5.3. Offline command

Mỗi mutation được queue phải có:

- `clientCommandId` ổn định qua retry.
- Idempotency key và payload hash.
- Thời điểm tạo, loại command và trạng thái retry.
- Điều kiện hết hạn; command phụ thuộc thời gian không được gửi muộn vô hạn.

Không queue accept proposal, boarding, payment acknowledgement hoặc transition nhạy
cảm nếu client không thể kiểm tra lại trạng thái hiện tại. Những thao tác này hiển thị
lỗi mạng và yêu cầu user thử lại.

### 5.4. Location

- Chỉ bật khi user là participant của booking active và đã consent rõ ràng.
- Server vẫn quyết định booking/state/role hợp lệ; client flag không có thẩm quyền.
- Exact location dùng TTL hiện hành, không tạo GPS history.
- Stop tracking khi booking kết thúc, logout, revoke, account lock hoặc user tắt consent.
- Notification hệ điều hành phải thể hiện rõ khi background location đang chạy.

## 6. Work breakdown

| ID     | Đầu ra                                                               | Phụ thuộc         | Điều kiện nghiệm thu                                                    |
| ------ | -------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| S16-00 | Audit contract, threat model, ADR bổ sung nếu contract auth thay đổi | G16-01–07         | Không còn quyết định security mở trước khi code auth                    |
| S16-01 | Expo workspace, Development Build và local/test/staging config       | S16-00            | Android/iOS development build tái lập được                              |
| S16-02 | Dùng chung generated TypeScript client, transport và contract tests  | S16-01            | Web/mobile dùng cùng OpenAPI; CI phát hiện generated code lệch          |
| S16-03 | Theme/design token, router, localization và app shell                | S16-01            | Light/dark, text scaling, deep-link skeleton và navigation test đạt     |
| S16-04 | Google native login, session storage, refresh/re-auth và logout      | S16-02–03         | Login/restart/logout/revoke/account-lock chạy trên hai nền tảng         |
| S16-05 | Onboarding, profile và verification/simulated access                 | S16-04            | Local/test đi vào app đúng `nextAction`, không gọi OTP sai mode         |
| S16-06 | Feed, search, map, schedules và travel intents                       | S16-02–05         | Loading/empty/error/offline, pagination và privacy đúng contract        |
| S16-07 | Trip, proposal và booking                                            | S16-06            | Cả passenger/driver flow, capacity và stale version được server bảo vệ  |
| S16-08 | Realtime, chat, notifications và deep links                          | S16-04, G16-04–05 | Reconnect không lặp, unread đúng, block/revoke mất quyền                |
| S16-09 | Push registration, FCM/APNs adapters và notification routing         | S16-08            | Rotate/logout/multi-device và redacted payload test đạt                 |
| S16-10 | Active journey, foreground location và state transitions             | S16-07–08         | Arrive/board/start/complete đúng authority và server time               |
| S16-11 | Background location lifecycle                                        | S16-10, G16-07    | Chỉ active booking; stop đầy đủ; đo pin trên thiết bị thật              |
| S16-12 | Offline cache và idempotent queue                                    | S16-07–10         | Airplane/restart/reconnect không tạo duplicate hoặc replay lệnh hết hạn |
| S16-13 | Payment acknowledgement, review và reporting tối thiểu               | S16-07            | Luồng booking hoàn thành đến review chạy được                           |
| S16-14 | Accessibility, security, performance và privacy hardening            | S16-04–13         | Không có secret/PII trong log; screen reader/text scale đạt             |
| S16-15 | Android/iOS E2E, CI artifacts và bàn giao Stage 17                   | S16-14            | Critical journey đạt trên thiết bị thật và build commit xác định        |

## 7. Thứ tự PR đề xuất

1. **PR 16.1 — Foundation:** S16-00–03.
2. **PR 16.2 — Identity:** S16-04–05 và backend mobile-session contract.
3. **PR 16.3 — Discovery:** S16-06.
4. **PR 16.4 — Booking:** S16-07.
5. **PR 16.5 — Realtime and push:** S16-08–09.
6. **PR 16.6 — Journey and location:** S16-10–11.
7. **PR 16.7 — Resilience and completion:** S16-12–13.
8. **PR 16.8 — Hardening and acceptance:** S16-14–15.

Mỗi PR phải gồm contract/test của chính thay đổi đó. Không dồn authentication,
background location và device testing sang PR cuối.

## 8. Kiểm thử bắt buộc

### 8.1. Unit và widget

- Session state machine, expiry, revoke và storage failure.
- Router/deep link với anonymous, onboarding, authorized và forbidden state.
- Pagination, error mapping, retry/backoff và offline queue.
- Serialization/generated client và backward-compatible enum handling.
- Location lifecycle và stop conditions.
- Widget loading, empty, error, offline, disabled/pending và accessibility semantics.

### 8.2. Integration

- Google fake provider local/test; Google native sandbox trên thiết bị kiểm thử.
- Secure storage qua restart, logout và account switching.
- REST + STOMP reconnect, message deduplication và permission revocation.
- Push token rotate, multi-device logout và deep link từ cold start.
- Airplane mode, process kill, clock skew và server conflict.
- Android/iOS permission denied, limited/approximate location và background kill.

### 8.3. Critical E2E

```text
Google login
→ consent/onboarding
→ tìm chuyến
→ proposal
→ booking
→ chat/thông báo
→ active journey và location consent
→ complete
→ payment acknowledgement
→ review
```

Chạy cả chiều passenger yêu cầu và driver đề nghị, xe máy và ô tô, Android và iOS.

## 9. CI và quality gates

CI bổ sung các job độc lập:

- TypeScript format, ESLint, typecheck, unit/component tests.
- Expo config validation và Development Build cho Android/iOS.
- EAS Build preview profile; production signing/submission để Stage 17.
- Contract drift check cho generated TypeScript client dùng chung.
- Artifact chỉ gồm report/log đã redact; không upload secure storage hoặc token.

Gate toàn repo vẫn giữ:

```powershell
corepack pnpm check
corepack pnpm api:check
.\mvnw.cmd -B -ntp verify
corepack pnpm --filter @dike/mobile lint
corepack pnpm --filter @dike/mobile typecheck
corepack pnpm --filter @dike/mobile test
corepack pnpm --filter @dike/mobile expo:doctor
```

## 10. Security và privacy gates

- Certificate/TLS validation mặc định; không ship bypass cho local debug.
- Token chỉ trong secure storage và memory cần thiết, không ở URL hoặc clipboard.
- Deep link không chứa token, tọa độ, địa chỉ riêng tư hoặc nội dung chat.
- Screenshot/app-switcher che màn hình nhạy cảm khi hợp lý.
- Push payload tối thiểu và authorize lại sau khi mở.
- Queue/database local mã hóa hoặc không lưu dữ liệu nhạy cảm; logout xóa dữ liệu user.
- Background task không sống ngoài active booking và consent.
- Jailbreak/root detection chỉ là signal; không thay server authorization.

## 11. Quan sát và vận hành

- Gắn app version, platform và correlation ID vào request; không dùng user ID làm
  metric label.
- Theo dõi login failure, session revoke, API latency/error, STOMP reconnect,
  notification delivery/open, queue depth/age và location update failure.
- Crash report phải redact token, message, phone, address và coordinates.
- Feature flag server-side cho push/background location; tắt được mà không cần phát
  hành app mới.

## 12. Rollout và rollback

1. Internal Android với fake identity/push/location.
2. Internal iOS cùng contract và test matrix.
3. Staging với Google test client, FCM/APNs sandbox và tài khoản tổng hợp.
4. Device matrix và battery/network tests.
5. Bàn giao signed candidate, store metadata và rollout checklist cho Stage 17.

Nếu lỗi nghiêm trọng, server flag phải tắt push/background location hoặc mutation
mobile mới mà vẫn giữ read-only access và logout. Backend contract additive trong
giai đoạn rollout; không xóa endpoint/field khi app version cũ còn được hỗ trợ.

## 13. Definition of Done

- `apps/mobile` build/test Android và iOS từ checkout sạch bằng Expo Development Build.
- Web và mobile dùng cùng generated TypeScript client từ OpenAPI.
- Native login, secure session, revoke và logout đạt threat-model test.
- Push/deep link không rò dữ liệu và authorize lại từ server.
- Offline retry không tạo duplicate hoặc thực thi command hết hạn.
- Background location chỉ chạy trong active booking có consent và dừng ở mọi exit path.
- Critical E2E đạt trên ít nhất một thiết bị Android và một thiết bị iOS thật.
- Luồng tìm chuyến → booking → hành trình → đánh giá chạy được trên cả hai nền tảng.
- Có report accessibility, battery/network, security và danh sách hạn chế thực tế.
- Toàn bộ repo gates, Expo/EAS gates và contract drift checks đều xanh.

## 14. Bàn giao Stage 17

- App identifiers, signing ownership và secret inventory không chứa secret trong repo.
- Danh sách Google OAuth client, FCM/APNs environment và rotation procedure.
- Store build/release checklist, privacy disclosure và data-safety inventory.
- Compatibility window và minimum supported app version policy.
- Dashboard/alert cho mobile auth, push, realtime và location.
- Rollback/kill-switch đã diễn tập trên staging.
