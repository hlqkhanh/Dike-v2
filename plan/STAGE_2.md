# STAGE 2 — Google authentication và session

Ngày lập kế hoạch: 06/10/2026
Trạng thái: In progress — implementation đã có; còn nghiệm thu Docker/CI, Google smoke và backlog
Điều kiện bắt đầu: Stage 1 đã hoàn thành và ADR 0006/0011 ở trạng thái Accepted

Tài liệu này là runbook triển khai Stage 2. `PLAN_MASTER.md` vẫn là nguồn đặc tả
sản phẩm và kiến trúc cao nhất. Nếu runbook mâu thuẫn với master plan hoặc ADR đã
Accepted thì master plan và ADR được ưu tiên, đồng thời phải sửa runbook trong
cùng thay đổi.

## Tiến độ triển khai

Đã triển khai trong working tree:

- Identity domain, Mongo documents/index migration và transactional provisioning.
- Spring Security Google OIDC, PKCE S256, opaque Spring Session Redis, CSRF/origin
  protection, absolute expiry, giới hạn session và rate limit khởi tạo login.
- Session/phone REST API, OpenAPI contract và TypeScript client.
- Next.js same-origin proxy, login, auth completion, phone onboarding và quản lý
  session.
- Unit/architecture/contract tests và Testcontainers integration test với mock OIDC,
  MongoDB, Redis, PKCE, session, CSRF và phone onboarding.

Chưa được phép đánh dấu `Completed` cho tới khi integration test chạy trên CI có
Docker, Google development OAuth smoke test được ghi nhận, backlog/milestone được
đóng và toàn bộ acceptance gate ở mục 14 đạt. Browser E2E hiện chạy trên Chromium
desktop và mobile viewport trong CI.

Nghiệm thu local ngày 06/10/2026:

- `pnpm check`: pass.
- Playwright: 6/6 test pass trên Chromium desktop và mobile viewport.
- `mvnw verify`: pass 22 unit/architecture test; 5 integration test bị skip vì máy
  local không có Docker daemon.
- GitHub backlog/CI chưa thể cập nhật vì credential `gh` của owner đã hết hiệu lực.
- Google OAuth thật chưa chạy vì repository không chứa và không được phép tự tạo
  development client secret.

## 1. Mục tiêu

Stage 2 tạo lát cắt xác thực web hoàn chỉnh đầu tiên của Dike:

- Đăng nhập Google OIDC bằng Spring Security Authorization Code + PKCE.
- Tạo `User` và `AuthIdentity` trong MongoDB.
- Quản lý opaque web session bằng Spring Session Redis.
- Web truy cập Spring Boot qua same-origin proxy `/api/*` của Next.js theo ADR 0011.
- Có CSRF/origin protection, refresh, danh sách thiết bị, revoke, logout hiện tại
  và logout toàn bộ.
- Sau đăng nhập, người dùng nhập số điện thoại nhưng trạng thái vẫn là
  `UNVERIFIED`.
- Không tồn tại demo header, endpoint giả mạo user hoặc token Google trong browser
  storage.

## 2. Quyết định và ranh giới đã khóa

### 2.1. Session và cookie

- Idle timeout là 24 giờ.
- Absolute lifetime là 30 ngày; refresh không kéo dài mốc tuyệt đối.
- Refresh xoay session ID và CSRF token.
- Cookie production là `__Host-DIKE_SESSION`, có `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/` và không đặt `Domain`.
- Local HTTP dùng tên `DIKE_SESSION` và `Secure=false`.
- CSRF dùng cookie `XSRF-TOKEN` đọc được bởi JavaScript và header
  `X-XSRF-TOKEN`.
- Session thật nằm trong Redis; cookie chỉ chứa opaque session ID ngẫu nhiên.
- Không fallback sang session in-memory khi Redis lỗi.

### 2.2. Account provisioning

- Identity key duy nhất là `issuer + subject`, không phải email hoặc số điện thoại.
- Không tự liên kết tài khoản bằng email hoặc số điện thoại, kể cả email Google đã
  xác minh.
- Google identity mới có email trùng user hiện hữu trả
  `ACCOUNT_LINK_REQUIRED`; không merge và không tạo user trùng.
- CI dùng OIDC test server; nghiệm thu có thêm một manual smoke test bằng Google
  OAuth thật.
- Google token và authorization code không được lưu trong MongoDB, Redis log hoặc
  browser storage.

### 2.3. Phone onboarding

- Local/test dùng `REQUIRE_PHONE_OTP=false`; staging/production dùng `true`.
- Khi OTP không bắt buộc, user được đi tiếp nhưng `phoneStatus` vẫn là
  `UNVERIFIED` và không nhận quyền verified.
- Số điện thoại được chuẩn hóa E.164 nhưng chưa unique khi chưa xác minh.
- Không tạo fake OTP provider hoặc endpoint tự xác minh trong Stage 2.

### 2.4. Ngoài phạm vi

- Gửi/xác minh OTP, brute-force OTP, cooldown và phone uniqueness sau xác minh —
  Stage 3.
- Role nghiệp vụ `VERIFIED_MEMBER`, `APPROVED_DRIVER`, `MODERATOR`, `ADMIN` —
  Stage 3.
- Hồ sơ đầy đủ, consent, privacy và avatar — Stage 4.
- Account-linking UI hoặc khôi phục tài khoản.
- Social login ngoài Google.
- Mobile login/token; Flutter credential transport được thực hiện ở giai đoạn
  mobile.

## 3. Kiến trúc đích

### 3.1. Luồng web

```text
Browser
  │ first-party cookie, /api/*
  ▼
Next.js/Vercel same-origin proxy
  │ server-to-server HTTP
  ▼
Spring Boot API/Render
  ├── Spring Security OAuth2/OIDC
  ├── identity module
  ├── MongoDB: User + AuthIdentity
  └── Redis: opaque session + rate limit
```

Next.js chỉ chuyển tiếp transport. Spring Boot là nơi duy nhất sở hữu OAuth,
session, user, CSRF, authorization và nghiệp vụ. Biết URL Render không được phép
bỏ qua security; proxy không phải authorization boundary.

### 3.2. Ranh giới identity module

```text
identity/
  api/              REST DTO/controller, OAuth success/failure adapter
  application/      provisioning, session và phone onboarding use case
  domain/           User, AuthIdentity, enum và policy
  infrastructure/
    mongo/          document/repository
    redis/          Spring Session và session lookup
    security/       Spring Security, OIDC và CSRF
```

Ràng buộc:

- Controller chỉ gọi application service.
- Domain không phụ thuộc Spring Security, MongoDB, Redis hoặc servlet API.
- Infrastructure triển khai port do identity module sở hữu.
- Module khác chỉ dùng public API/principal contract được identity công bố.
- Worker profile không tạo servlet security chain hoặc web session.

### 3.3. Dependency cần bổ sung

- `spring-boot-starter-security`.
- `spring-boot-starter-oauth2-client`.
- `spring-session-data-redis`.
- Libphonenumber được pin trong dependency matrix.
- OIDC HTTP mock server chỉ cho test.
- Testcontainers Redis cho integration test.
- TanStack Query, React Hook Form và Zod cho web.
- Playwright cho browser E2E.

Không override dependency do Spring Boot BOM quản lý nếu chưa có compatibility
test và lý do được ghi trong dependency matrix.

## 4. Dữ liệu và persistence

### 4.1. User

`User` có:

- `id`.
- `canonicalEmail`.
- `displayName`.
- `avatarUrl`.
- `accountStatus`: `ACTIVE | LOCKED`.
- `onboardingStatus`: `PHONE_REQUIRED | PHONE_SUBMITTED`.
- `phoneCandidateE164`, nullable.
- `phoneStatus`: `NOT_PROVIDED | UNVERIFIED`.
- `createdAt`, `updatedAt`.
- Version cho optimistic concurrency.

Stage 2 chỉ giữ snapshot tên/avatar từ Google để hiển thị onboarding. Profile đầy
đủ và quyền chỉnh sửa thuộc Stage 4.

### 4.2. AuthIdentity

`AuthIdentity` có:

- `id`.
- `provider`: `GOOGLE`.
- `issuer`.
- `subject`.
- `userId`.
- `emailSnapshot`.
- `emailVerified`.
- `createdAt`, `lastLoginAt`.

Không lưu Google access token, refresh token, authorization code hoặc raw ID token.

### 4.3. Index migration

Thêm migration versioned, idempotent:

- Unique `(issuer, subject)` trên `auth_identities`.
- Index `userId` trên `auth_identities`.
- Index tra cứu `canonicalEmail` trên `users`.
- Ràng buộc chống tạo đồng thời hai user cùng canonical Google email.
- Không tạo unique index cho `phoneCandidateE164`; Stage 3 chỉ unique số đã xác
  minh.

Migration phải chạy an toàn khi API và worker cùng khởi động theo cơ chế lock/checksum
của Stage 1.

### 4.4. Transaction provisioning

Token exchange và gọi Google diễn ra trước transaction. Sau khi Spring xác minh
OIDC, provisioning chạy trong Mongo transaction:

1. Tìm `AuthIdentity` bằng `(issuer, subject)`.
2. Nếu tồn tại, tải đúng user và cập nhật `lastLoginAt`.
3. Nếu chưa tồn tại, kiểm tra collision theo canonical email.
4. Nếu collision, trả `ACCOUNT_LINK_REQUIRED`, không ghi dữ liệu.
5. Nếu không collision, tạo `User` và `AuthIdentity` nguyên tử.
6. Map duplicate-key race thành conflict ổn định, không retry mù.

Nếu identity hiện hữu đổi email thành email đang thuộc user khác, vẫn cho login
bằng `issuer + subject`, giữ email hiện tại và ghi audit/metric; không tự chuyển
ownership.

## 5. Google OIDC và Spring Security

- Dùng Spring Security OAuth2 Client; không tự viết token exchange hoặc JWT
  verification.
- Scope tối thiểu: `openid`, `email`, `profile`.
- PKCE bắt buộc với `S256` qua authorization request resolver.
- State và authorization request lưu trong server-side session.
- Nonce và OIDC claims được Spring Security xác minh.
- Chỉ chấp nhận issuer Google đã cấu hình, audience đúng client ID, token chưa hết
  hạn và `email_verified=true`.
- Không yêu cầu Google hosted domain.
- Sau provisioning, chuyển principal thành Dike principal chứa `userId`; không
  dùng Google token làm application credential.
- Xóa authorized client/token Google khỏi session sau khi đã lấy claims cần thiết.
- Session-fixation protection phải đổi session ID sau login.
- Redirect thành công cố định tới `/auth/complete`; không nhận arbitrary redirect
  URL từ client.
- Failure redirect chỉ chứa error code an toàn, không chứa provider response hoặc
  token.

OAuth client ID/secret và public callback base URL đọc từ typed configuration và
environment. Production/staging fail fast khi thiếu hoặc dùng cấu hình không an
toàn.

## 6. Public API và contract

| Method   | Endpoint                                | Hành vi                                     |
| -------- | --------------------------------------- | ------------------------------------------- |
| `GET`    | `/api/v1/auth/google`                   | Khởi tạo Google login và redirect           |
| `GET`    | `/api/v1/auth/callback/google`          | Spring Security xử lý callback              |
| `GET`    | `/api/v1/auth/session`                  | Trả user/session và tạo CSRF cookie         |
| `POST`   | `/api/v1/auth/session/refresh`          | Xoay session ID và CSRF token               |
| `GET`    | `/api/v1/auth/sessions`                 | Liệt kê session/thiết bị của user           |
| `DELETE` | `/api/v1/auth/sessions/{sessionHandle}` | Revoke một thiết bị                         |
| `POST`   | `/api/v1/auth/logout`                   | Logout session hiện tại                     |
| `POST`   | `/api/v1/auth/logout-all`               | Revoke toàn bộ session của user             |
| `PUT`    | `/api/v1/auth/phone`                    | Lưu phone candidate ở trạng thái UNVERIFIED |

`GET /auth/session` trả tối thiểu:

```json
{
  "authenticated": true,
  "user": {
    "id": "...",
    "displayName": "...",
    "avatarUrl": "...",
    "email": "...",
    "onboardingStatus": "PHONE_REQUIRED",
    "phoneStatus": "NOT_PROVIDED",
    "phoneMasked": null,
    "nextAction": "SUBMIT_PHONE"
  },
  "session": {
    "id": "...",
    "createdAt": "...",
    "lastSeenAt": "...",
    "idleExpiresAt": "...",
    "absoluteExpiresAt": "..."
  }
}
```

Unauthenticated request trả `401 AUTHENTICATION_REQUIRED`, không trả giả
`authenticated=false` với HTTP 200.

`PUT /auth/phone` nhận:

```json
{
  "phoneNumber": "0901234567"
}
```

Số được chuẩn hóa với region mặc định `VN`, lưu E.164 và chỉ trả lại dạng mask.
Người dùng được đổi candidate khi chưa verified.

Error code ổn định:

- `AUTHENTICATION_REQUIRED`.
- `AUTH_SESSION_EXPIRED`.
- `AUTH_SESSION_REVOKED`.
- `OIDC_LOGIN_FAILED`.
- `OIDC_CLAIM_INVALID`.
- `ACCOUNT_LINK_REQUIRED`.
- `AUTH_RATE_LIMITED`.
- `CSRF_INVALID`.
- `ORIGIN_NOT_ALLOWED`.
- `PHONE_INVALID`.
- `SESSION_NOT_FOUND`.

OpenAPI mô tả cookie security scheme, CSRF header, operation, DTO và response lỗi.
Generated client là nguồn type/operation mặc định của web.

## 7. Session Redis

Dùng Spring Session Redis indexed repository:

- Namespace chứa environment để các môi trường không dùng chung key.
- Principal index là Dike `userId` để liệt kê và revoke toàn bộ session.
- Mỗi session có public `sessionHandle` ngẫu nhiên riêng; API không trả raw cookie
  ID.
- Metadata: `createdAt`, `lastSeenAt`, `deviceLabel`, `absoluteExpiresAt`.
- `deviceLabel` suy ra từ User-Agent đã sanitize; không fingerprint người dùng.
- Không trả hoặc log IP đầy đủ.
- Giới hạn 10 active sessions/user; session thứ 11 thu hồi session cũ nhất.
- `lastSeenAt` cập nhật tối đa một lần mỗi 5 phút để tránh ghi Redis mỗi request.
- Filter kiểm tra account status, idle timeout, absolute expiry và revoked state.
- Cookie còn tồn tại nhưng Redis session mất/hết hạn phải trả 401 và được clear.
- Danh sách session chỉ trả public handle, label và timestamp.
- Revoke session hiện tại phải clear cookie browser.
- Refresh đổi session ID và CSRF token nhưng giữ `absoluteExpiresAt` ban đầu.

## 8. Phone onboarding

- Chuẩn hóa số bằng libphonenumber với region `VN`.
- Lưu dạng E.164, ví dụ `+84901234567`.
- Không dùng phone để tìm, merge hoặc đăng nhập.
- Không kiểm tra uniqueness trong Stage 2.
- Sau submit: `PHONE_SUBMITTED` và `UNVERIFIED`.
- `REQUIRE_PHONE_OTP=true` trả `nextAction=VERIFY_PHONE`.
- `REQUIRE_PHONE_OTP=false` trả `nextAction=NONE` nhưng không cấp verified
  authority.
- Staging/production từ chối khởi động nếu `REQUIRE_PHONE_OTP=false`.

## 9. CSRF, origin và security hardening

- Mọi mutation dùng cookie auth phải có CSRF token hợp lệ.
- Chỉ bỏ CSRF cho OAuth authorization/callback đúng endpoint; không ignore toàn
  bộ `/auth/**`.
- Kiểm tra `Origin`, fallback `Referer` khi phù hợp, bằng exact allowlist.
- Mutation thiếu cả Origin và Referer bị từ chối trong web flow.
- Không dùng wildcard origin với credentials.
- Auth/session response dùng `Cache-Control: no-store`.
- Logout/revoke clear cookie bằng cùng name/path/secure/same-site khi tạo.
- Chỉ tin forwarded headers từ proxy đã cấu hình; callback URL lấy từ public base
  URL typed property.
- Login initiation rate limit 10 lần/10 phút/IP tin cậy.
- Failure callback rate limit 20 lần/10 phút/IP tin cậy.
- Redis rate-limit failure phải fail-closed cho auth initiation.
- UI chỉ nhận lỗi account-linking tổng quát, không xác nhận email nào đã tồn tại.
- Không có `X-User-Id`, demo token, fake-login endpoint hoặc test controller trong
  production source.

Log không chứa Google secret, authorization code, ID/access token, session ID,
CSRF token, email hoặc phone đầy đủ.

## 10. Next.js same-origin proxy và web

### 10.1. Proxy

- Browser chỉ dùng URL tương đối `/api/...`.
- `DIKE_API_INTERNAL_ORIGIN` là server-side environment variable, không dùng
  `NEXT_PUBLIC_`.
- Local mặc định `http://localhost:8080`.
- Proxy chỉ forward `/api/:path*` tới một upstream cố định; client không chọn
  upstream.
- Giữ method, query, body, cookie, `Set-Cookie`, CSRF header, request ID và status.
- Không retry mutation, không cache authenticated response và không log
  cookie/code/token.
- OAuth redirect URI công khai đi qua Next.js origin.
- Không tạo Next.js business API hoặc auth session riêng.

### 10.2. Web screens

- `/login`: nút “Tiếp tục với Google”, trạng thái lỗi an toàn.
- `/auth/complete`: tải session rồi điều hướng theo `nextAction`.
- `/onboarding/phone`: nhập số Việt Nam, validation accessible, loading/error/retry.
- `/account/sessions`: danh sách thiết bị, revoke từng session, logout tất cả.
- App shell hiển thị trạng thái signed-in và logout.

Frontend rules:

- Không lưu token/session trong `localStorage`, `sessionStorage`, Zustand hoặc
  React state dài hạn.
- Session state lấy từ generated API client qua TanStack Query.
- Form dùng React Hook Form + Zod; backend vẫn là nguồn validation cuối.
- Mutation đọc CSRF cookie và gửi `X-XSRF-TOKEN`.
- Sau 401, xóa query cache nhạy cảm và chuyển về `/login`; không refresh vô hạn.
- Refresh chỉ chạy có chủ đích khi app khởi động hoặc gần idle expiry và chỉ có
  một request đồng thời.
- UI có keyboard navigation, focus management, label và thông báo lỗi cho screen
  reader.

## 11. Thứ tự triển khai

Thực hiện theo lát cắt nhỏ, luôn giữ `main` xanh:

1. Đồng bộ ADR/runbook và dependency matrix.
2. Tạo identity domain, persistence và indexes.
3. Dựng Spring Security + Redis session foundation.
4. Tích hợp Google OIDC + PKCE.
5. Thêm session lifecycle API.
6. Thêm phone onboarding.
7. Hoàn thiện CSRF/origin/rate limit.
8. Sinh OpenAPI operation client.
9. Dựng Next.js proxy và web flow.
10. Thêm automated E2E, Google smoke, observability và acceptance.

Mỗi work item dưới đây là một issue độc lập. Auth, security, dependency và ADR
phải qua PR/review/CI theo quy ước nhóm.

## 12. Work breakdown

### S2-00 — Preflight và đồng bộ quyết định

**Phụ thuộc:** Stage 1, ADR 0006 và ADR 0011.

- Commit/merge ADR 0011, tài liệu same-origin proxy và cập nhật master plan hiện
  có trong working tree.
- Tạo runbook này và liên kết từ `PLAN_MASTER.md`.
- Chạy Stage 1 acceptance, Mongo/Redis health và toàn bộ quality gate.
- Cập nhật dependency matrix với Security, Session, libphonenumber, OIDC test
  server và Playwright.
- Tạo issue S2-00 đến S2-11 trong milestone Stage 2.

**Hoàn thành khi:** baseline sạch, CI xanh và không còn quyết định auth mâu thuẫn.

### S2-01 — Identity domain, Mongo documents và indexes

**Phụ thuộc:** S2-00.

- Tạo domain model, application ports và Mongo adapters.
- Thêm migration indexes cho identity/user.
- Implement transactional provisioning và collision policy.
- Test create, repeat login, concurrent first login, email collision và rollback.

**Hoàn thành khi:** cùng `issuer + subject` luôn trả cùng user và collision không
tạo dữ liệu một phần.

### S2-02 — Spring Security và Redis session foundation

**Phụ thuộc:** S2-00, S2-01.

- Thêm security dependencies và typed auth/session properties.
- Cấu hình Spring Session Redis indexed repository, namespace và TTL.
- Tạo Dike principal, absolute-expiry filter, session metadata và maximum-session
  policy.
- Phân tách API/worker configuration.
- Thêm production guard cho cookie, origin, public URL và `REQUIRE_PHONE_OTP`.

**Hoàn thành khi:** restart API không mất session Redis và worker không mở auth
web stack.

### S2-03 — Google OIDC + PKCE

**Phụ thuộc:** S2-01, S2-02.

- Cấu hình Google client từ environment secrets.
- Thêm authorization resolver bắt buộc PKCE S256.
- Cấu hình callback, success/failure handlers và Dike principal.
- Validate claims và xóa Google authorized client sau provisioning.
- Không thêm mock auth vào main runtime.

**Hoàn thành khi:** mock OIDC flow chứng minh state, nonce, PKCE và claims được
kiểm tra.

### S2-04 — Session lifecycle APIs

**Phụ thuộc:** S2-02, S2-03.

- Implement current session, refresh, list devices, revoke, current logout và
  global logout.
- Xoay session/CSRF khi refresh.
- Bảo đảm revoke có hiệu lực ngay trên request tiếp theo.
- Xử lý Redis failure fail-closed, không tạo in-memory fallback.

**Hoàn thành khi:** per-device và global logout hoạt động với nhiều browser
context.

### S2-05 — Phone onboarding

**Phụ thuộc:** S2-01, S2-04.

- Thêm phone normalization/validation.
- Implement submit/update candidate và trạng thái onboarding.
- Thêm môi trường `REQUIRE_PHONE_OTP`.
- Không cấp verified role hoặc tạo fake OTP.

**Hoàn thành khi:** local flow đi tiếp với phone vẫn `UNVERIFIED`, còn
staging/production yêu cầu bước OTP chưa được Stage 3 triển khai.

### S2-06 — CSRF, origin và security hardening

**Phụ thuộc:** S2-02, S2-04.

- Cấu hình CSRF cookie/header, exact origin allowlist và trusted proxy.
- Thêm auth rate limit Redis.
- Thêm no-store headers, safe redirect/error mapping và log redaction.
- Kiểm tra session fixation, open redirect, host-header poisoning và cache leakage.

**Hoàn thành khi:** toàn bộ negative security test trả status/error code đúng và
không tạo session ngoài ý muốn.

### S2-07 — OpenAPI và TypeScript client

**Phụ thuộc:** S2-04, S2-05, S2-06.

- Mô tả toàn bộ auth/session/phone DTO và security scheme.
- Nâng generator để sinh typed operations deterministic, không chỉ schema.
- Thêm auth API wrapper duy nhất trong `api-client-ts`.
- CI fail khi OpenAPI/client stale.

**Hoàn thành khi:** web không tự định nghĩa auth response hoặc tự ghép backend
URL.

### S2-08 — Next.js proxy

**Phụ thuộc:** S2-00, S2-03.

- Thêm fixed upstream proxy `/api/*`.
- Cấu hình local, preview, staging và production origin.
- Preserve cookie/header/status; không cache/retry mutation.
- Thêm proxy contract test và open-proxy negative test.

**Hoàn thành khi:** OAuth callback và session cookie đi qua web origin, không qua
browser cross-site fetch.

### S2-09 — Web login, onboarding và session management

**Phụ thuộc:** S2-07, S2-08.

- Implement bốn screen auth.
- Thêm session bootstrap, protected-page behavior, form validation và error UX.
- Hỗ trợ keyboard, focus, screen reader, loading/offline/retry.
- Không hiển thị hoặc lưu credential phía client.

**Hoàn thành khi:** user mới login → nhập phone → reload → quản lý session được
trên desktop/mobile viewport.

### S2-10 — Automated E2E và Google smoke

**Phụ thuộc:** S2-03 đến S2-09.

- Dựng OIDC test server có authorization, token, JWKS và UserInfo endpoint.
- Thêm Redis/Mongo Testcontainers integration suite.
- Playwright chạy Next proxy + Spring + mock OIDC với nhiều browser context.
- Viết runbook Google Console và chạy một manual smoke bằng development OAuth
  client.
- Secret chỉ nằm trong environment; evidence không chứa token/email thật.

**Hoàn thành khi:** CI E2E xanh và issue nghiệm thu ghi nhận Google smoke thật.

### S2-11 — Observability, CI và acceptance

**Phụ thuộc:** S2-10.

- Metric: login success/failure reason, active session, refresh, revoke, expiry,
  Redis failure và auth rate limit.
- Log audit không chứa token, cookie, code, email/phone đầy đủ.
- Thêm CI job auth integration/E2E với timeout và artifact không nhạy cảm.
- Cập nhật README, environment example và troubleshooting.
- Chạy fresh-clone drill và đóng milestone Stage 2.

**Hoàn thành khi:** toàn bộ acceptance gate tại mục 14 đạt.

## 13. Test plan

### 13.1. Positive

- Google user mới tạo đúng một `User` và một `AuthIdentity`.
- Login lặp lại trả cùng user.
- Session sống qua API restart và mất khi Redis key hết hạn.
- Refresh đổi cookie ID, giữ user và absolute expiry.
- Hai browser tạo hai session; revoke một session không ảnh hưởng session kia.
- Logout-all vô hiệu toàn bộ session.
- Phone Việt Nam được chuẩn hóa E.164 và lưu `UNVERIFIED`.
- Same-origin proxy hoạt động trên local và production-like HTTPS.
- Reload browser vẫn authenticated.
- Manual Google development login thành công.

### 13.2. Negative và security

- State, nonce, PKCE verifier, issuer, audience, expiry hoặc `email_verified` sai
  không tạo user/session.
- Concurrent first login không tạo duplicate.
- Email collision trả `ACCOUNT_LINK_REQUIRED`, không merge.
- Session fixation ID trước/sau login khác nhau.
- Session quá idle/absolute expiry bị xóa và cookie được clear.
- Revoke cookie cũ không sử dụng lại được.
- Mutation thiếu/sai CSRF hoặc origin ngoài allowlist trả 403.
- Callback/login không tạo open redirect.
- Host/forwarded header giả không thay đổi callback URL.
- Proxy không nhận arbitrary upstream và không cache auth response.
- Production không khởi động với cookie insecure, wildcard origin, thiếu OAuth
  secret hoặc `REQUIRE_PHONE_OTP=false`.
- Không có demo auth shortcut trong production source.
- Secret scan/log test không thấy Google secret, auth code, token, session ID hoặc
  phone đầy đủ.

### 13.3. Contract và accessibility

- Error envelope tiếp tục đúng contract Stage 1 và luôn có request ID.
- OpenAPI generation chạy hai lần không sinh diff.
- TypeScript client compile và mặc định gửi credentials.
- Login/phone/session pages dùng được bằng bàn phím, có focus/error announcement
  và không có accessibility violation nghiêm trọng.
- Viewport mobile/desktop không làm mất thao tác logout/revoke.

## 14. Acceptance gate cuối

- `pnpm check`, `pnpm api:check` và Maven `verify` xanh.
- Auth integration và Playwright E2E xanh trong CI.
- Login, onboarding phone, refresh, revoke, current logout và global logout chạy
  qua UI.
- Cookie/CSRF/origin policy đúng ADR 0006 và 0011.
- MongoDB không chứa Google token; browser storage không chứa credential.
- Real Google smoke được ghi nhận mà không commit secret/PII.
- OpenAPI và generated TypeScript client đồng bộ.
- `PLAN_MASTER.md`, ADR và runbook này thống nhất.
- Milestone Stage 2 không còn issue mở.

## 15. Failure handling và rollback

- Google unavailable/token exchange lỗi: không tạo user/session; redirect về login
  với safe error code và retry action.
- Redis unavailable: auth/session operation fail-closed; readiness báo degraded,
  không fallback in-memory.
- Mongo transaction lỗi: không phát session cho user chưa provision thành công.
- Email collision: không merge; trả `ACCOUNT_LINK_REQUIRED` và giữ dữ liệu nguyên
  trạng.
- Proxy upstream timeout: trả lỗi gateway có request ID, không retry mutation.
- Deploy lỗi auth: rollback API và web cùng contract-compatible version; Redis
  session format phải đọc tương thích trong rolling deploy.
- Nếu secret bị lộ: revoke/rotate Google client secret và invalidate session nếu
  phạm vi ảnh hưởng yêu cầu; xóa file khỏi history không thay thế rotation.
- Không rollback bằng cách bật demo auth, bỏ CSRF hoặc dùng header giả mạo user.

## 16. Giả định

- Stage 1 đã hoàn tất; Mongo replica set, Redis, API, web và CI hoạt động ổn định.
- Nhóm tạo riêng Google OAuth client cho development và production; redirect URI
  không dùng wildcard.
- Session policy 24 giờ idle/30 ngày absolute áp dụng cho web; mobile có policy
  riêng khi triển khai Flutter.
- Account linking được hoãn nhưng collision phải fail-safe ngay từ Stage 2.
- ADR 0011 và tài liệu same-origin proxy được merge trước code auth đầu tiên.
