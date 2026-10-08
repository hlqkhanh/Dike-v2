# STAGE 15 — Production Web UI và chế độ Tài xế thử nghiệm

## Mục tiêu

Stage 15 hoàn thiện Web UI cho các capability đã xây ở Stage 2–14 và tạo một đường thử nghiệm an toàn khi OTP/eKYC/duyệt phương tiện thật còn hoãn. Sau Google login, consent và nhập số điện thoại, user local/test nhận quyền hiệu lực của hành khách đã xác minh và tài xế được duyệt nhưng dữ liệu gốc vẫn là `UNVERIFIED`.

Quyết định kiến trúc nằm tại [ADR 0019](../docs/architecture/adr/0019-local-simulated-full-access.md). Simulation không phải cơ chế production và không cấp quyền admin/moderator.

## Public contract

- `AuthUser` bổ sung `accessMode`: `RESTRICTED | REAL | SIMULATED`.
- Khi đủ điều kiện local/test, session trả `verificationEvidence=SIMULATED`, `driverApprovalEvidence=SIMULATED` và các authority `MEMBER`, `VERIFIED_MEMBER`, `APPROVED_DRIVER`.
- `GET /api/v1/ride-capabilities` bổ sung `canCreateTrip`, `canManageBookings`, `accessMode` và `vehicles`.
- Xe mẫu ổn định: `simulated:motorcycle` (1 khách) và `simulated:car` (3 khách).
- `DIKE_SIMULATED_FULL_ACCESS_ENABLED=true` chỉ hợp lệ với `DIKE_ENVIRONMENT=local|test`.

## Work breakdown

### S15-00 — Baseline và tài liệu

- Liên kết runbook từ master plan, ghi ADR và cập nhật architecture/environment docs.
- Audit route/API hiện có; tái sử dụng UI Stage 2–14 thay vì tạo business API trong Next.js.

### S15-01 — Quyền thử nghiệm

- Tính quyền động từ ACTIVE + required consent + PHONE_SUBMITTED + phone E.164.
- Không ghi role/eKYC/verification giả; locked account không được cấp quyền.
- Hosted environment fail fast khi flag bật.

### S15-02 — Onboarding

- Sau phone submit, cập nhật session cache và đi thẳng vào app nếu `nextAction=NONE`.
- Không phát OTP challenge trong simulated mode; UI hiển thị phone chưa xác minh và quyền thử nghiệm.

### S15-03 — Xe thử nghiệm

- Cấp xe máy/ô tô tổng hợp qua ride capabilities.
- Backend validate ownership động, capacity, contribution và version; hosted environment từ chối namespace `simulated:`.

### S15-04 — Urban Mint và app shell

- Chuẩn hóa token/component semantic, focus, loading, empty, error, offline và retry.
- Navigation responsive hiển thị badge `Tài xế thử nghiệm`; admin link chỉ dựa vào authority thật.

### S15-05 — Màn hình nghiệp vụ

- Hoàn thiện profile/settings/verification, schedules/travel intents, feed/map, trip/proposal/booking, social, inbox/notifications và admin.
- Tạo `/trips/new`, `/schedules`, `/schedules/new`, `/schedules/[id]`, `/travel-intents/[id]` và `/verification` khi contract tương ứng sẵn sàng.
- Mutation quan trọng không optimistic; mutation có thể đảo ngược phải snapshot và rollback.

### S15-06 — PWA và accessibility

- Manifest, app icon, service worker và `/offline` shell.
- Không cache API/authenticated HTML/user data; không background GPS/sync.
- Critical flows đạt WCAG 2.2 AA, keyboard/focus đúng và không overflow mobile.

### S15-07 — Test và CI

- Mock Playwright chạy Desktop Chrome và Pixel 7 cho page state.
- Full-stack critical journey dùng Mongo/Redis/mock OIDC và dữ liệu tổng hợp.
- Axe không có lỗi `critical`/`serious`; artifact được redact.

## Acceptance

- Google/mock user → consent → phone → app không cần OTP ở local/test.
- Session có quyền hành khách/tài xế thử nghiệm nhưng Mongo vẫn `UNVERIFIED` và không có role giả.
- Tạo trip bằng cả hai xe mẫu, capacity được backend bảo vệ.
- Staging/production không thể bật simulation.
- UI luôn phân biệt thử nghiệm với xác minh thật; user không có admin access.
- PWA offline shell không lưu dữ liệu nhạy cảm.
- `pnpm check`, `pnpm api:check` và `mvnw verify` xanh.
