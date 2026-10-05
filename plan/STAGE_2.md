# STAGE 2 — Google authentication và session

Ngày rà soát: 06/10/2026.  
Trạng thái: Kế hoạch triển khai; chưa triển khai auth.  
Baseline rà soát: `6da8c76`. Điều kiện đóng stage: Stage 1 đạt nghiệm thu thật.

`PLAN_MASTER.md` và ADR Accepted là nguồn đặc tả cao nhất. Các giá trị timeout,
endpoint bổ sung và thiết kế dưới đây là phương án triển khai Stage 2, cần review
trong PR auth theo `CONTRIBUTING.md`; không thay đổi phạm vi production pilot.

## 1. Kết quả scan và điều kiện đầu vào

| Hạng mục       | Bằng chứng trong source                                                             | Việc cần làm                                                 |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Module backend | Có Modulith, ArchUnit và marker `identity`                                          | Bổ sung domain, application, adapter trong identity          |
| Persistence    | Có transaction manager, migration, outbox và Mongo IT                               | Chạy IT trên replica set thật trước nghiệm thu               |
| Authentication | Chưa có Spring Security/OAuth2 Client/Spring Session trong POM                      | Thêm dependency theo BOM, không tự viết OIDC validator       |
| API contract   | Script chỉ đọc JSON và sinh schema TS; parity test chỉ kiểm tra metadata/tên schema | Xuất contract từ runtime, so sánh toàn bộ và sinh operations |
| Web            | Có app shell, primitive và cấu hình API dùng chung                                  | Thêm login, onboarding và quản lý phiên                      |
| CI             | Có Maven verify; Mongo IT dùng `disabledWithoutDocker = true`                       | Gate phải thất bại khi IT bị skip vì thiếu Docker            |
| Local          | Docker pipe không tồn tại lúc scan                                                  | Khôi phục engine, không reset/purge volume                   |
| Toolchain      | PATH: Node 22.20.0, pnpm 11.25.0, Java 25; pnpm báo runtime Node 24.19.0            | Dùng đúng Node 24.21.0, pnpm 12.9.1, Java 21                 |

Đường dẫn JDK 21 trong dependency matrix không sử dụng được trên máy lúc scan;
lần gọi đầu Maven dừng ở kiểm tra `JAVA_HOME`. Đã tìm thấy JDK tại
`C:\Program Files\Java\jdk-21` và chạy lại với biến môi trường riêng cho process.
Đây là bằng chứng môi trường hiện tại, không
phủ nhận kết quả test lịch sử trong Stage 1. Chưa có bằng chứng CI từ lần rà soát
này. Không đổi các mục Stage 1 đang Pending/Implemented thành Complete.

Bằng chứng kiểm tra trong lượt scan:

- Maven `verify -DskipITs` với JDK 21: BUILD SUCCESS, 11 unit/architecture test đạt;
  integration test được chủ động bỏ qua vì Docker không khả dụng.
- Format, Markdown lint, repository file policy và action pin policy đạt.
- `pnpm check` đạt, gồm frontend lint, typecheck, 4 test và production build,
  trên runtime lệch baseline nêu trên;
  không thay thế fresh-clone gate với toolchain đã khóa.
- `node scripts/generate-api-client.mjs --check` đạt với contract hiện có;
  chưa chứng minh drift của operation vì contract Stage 1 chưa có business API.

Thứ tự ưu tiên trước khi đóng Stage 2:

1. S2-00: khôi phục gate Stage 1 và ghi report không có IT bị skip.
2. S2-01: sửa pipeline contract trước khi thêm operation auth.
3. S2-02 đến S2-06: backend identity, OAuth và session security.
4. S2-07 đến S2-09: web, kiểm thử và nghiệm thu Google thật.

## 2. Phạm vi

Trong phạm vi: Google Authorization Code + PKCE; User/AuthIdentity; session Redis;
CSRF/Origin; refresh, revoke từng phiên, logout và logout toàn bộ; nhập điện thoại
UNVERIFIED; giao diện và contract tương ứng.

Ngoài phạm vi: gửi/xác minh OTP (Stage 3), profile công khai/R2 (Stage 4), phương
tiện/eKYC, kết bạn, booking, mobile token exchange, triển khai production và account
linking nhiều provider. Không tạo demo header, endpoint tự chọn user hoặc login giả
trong ứng dụng local/staging/production. OIDC server giả chỉ được dùng trong test.

## 3. Thiết kế identity và dữ liệu

Ownership nằm trong `com.dike.identity`. Controller gọi application service;
domain không import Spring/Mongo/Redis. Repository và session/provider port do
identity sở hữu, adapter nằm trong infrastructure. Shared giữ concern kỹ thuật.

| Model        | Trường tối thiểu                                                                                               | Invariant/index                             |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| User         | id, displayName, email, phoneE164, phoneStatus, createdAt, updatedAt, version, sessionVersion                  | id unique; phone chưa xác minh không unique |
| AuthIdentity | id, provider, subject, userId, createdAt                                                                       | Unique `(provider, subject)`; index userId  |
| Session      | secret ID server-side, public deviceSessionId, userId, sessionVersion, issuedAt, lastSeenAt, absoluteExpiresAt | TTL Redis; public ID không phải credential  |

Google `sub` là khóa nhận diện, email chỉ là thuộc tính. Không merge tài khoản theo
email hay số điện thoại. Hai callback đầu tiên đồng thời phải tạo đúng một identity
và một user: ghi trong Mongo transaction, unique index làm trọng tài, transaction
thua rollback rồi đọc identity đã commit với retry hữu hạn.

Chỉ phát session sau Mongo commit. Redis lỗi sau commit trả lỗi có thể thử lại;
lần login kế tiếp tìm lại user, không tạo bản sao. Không giả định transaction bao
trùm Mongo và Redis. Không lưu Google access/refresh token khi không có nhu cầu gọi
Google API; không đưa token/claims nguyên bản vào DTO hoặc log.

Số điện thoại chuẩn hóa Việt Nam E.164, lưu `UNVERIFIED`. Endpoint không nhận
`phoneStatus`, role hoặc userId từ client. Đổi số luôn giữ trạng thái chưa xác minh;
chưa tạo verified-phone unique index trước Stage 3.

## 4. OAuth và topology trình duyệt

- Dùng Spring Security OAuth2 Client, scope tối thiểu `openid profile email`.
- Bật PKCE S256 tường minh và test authorization request có challenge; không suy
  luận confidential client sẽ tự bật PKCE.
- State, nonce và verifier gắn với phiên trước login, hết hạn sau 5 phút và chỉ
  sử dụng một lần. Callback sai/replay/thiếu cookie phải bị từ chối.
- Kiểm tra chữ ký, issuer, audience, expiry và nonce qua thư viện OIDC; issuer/token
  endpoints production cố định Google, không lấy từ request.
- Sau login đổi session ID, loại bỏ authentication request cũ và cấp CSRF mới.
- Redirect sau login dùng đường dẫn nội bộ allowlist; từ chối absolute URL, `//`,
  URL encode vượt allowlist. Không đưa code/token vào URL đích hoặc error message.
- Local: web localhost:3000, API localhost:8080, origin allowlist chính xác.
  Cookie HTTP ngoại lệ chỉ dành cho profile local/test.
- Staging/production: web và API dùng HTTPS trên cùng site với custom domain;
  cookie host-only trên API, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.
  Không mặc định cookie hoạt động giữa domain Vercel/Render khác site. Chốt domain
  và callback allowlist trước E2E staging; proxy phải lọc forwarded headers.
- CORS chỉ cho origin được cấu hình, credentials bật, không wildcard/reflection.
  API 401 trả envelope JSON, không tự redirect sang Google; login là điều hướng
  trình duyệt tới endpoint bắt đầu OAuth.

## 5. Vòng đời session và quyền

Ưu tiên Spring Session Data Redis indexed repository theo BOM để quản lý opaque
cookie `DIKE_SESSION`. DTO principal chỉ chứa định danh tối thiểu; serializer và
namespace Redis phải được chốt và kiểm thử tương thích trước merge.

Mặc định đề xuất: idle timeout 30 phút, absolute lifetime 7 ngày, tối đa 5 phiên
mỗi tài khoản. Các giới hạn cấu hình được, có validation; phiên thứ sáu bị từ chối
với hướng dẫn thu hồi phiên hoặc đăng nhập lại theo quy trình được review.

- Refresh chỉ hợp lệ với session chưa hết idle/absolute expiry, đổi credential và
  CSRF token, không kéo dài absolute lifetime. Credential cũ mất hiệu lực.
- Hai refresh đồng thời: tối đa một thành công; client gom refresh thành một
  request, không dùng refresh loop tự động khi 401. Redis atomic operation/lock
  cần test với nhiều instance, không chỉ `synchronized` trong một JVM.
- Revoke từng phiên kiểm tra owner và public deviceSessionId. Không trả secret
  session ID trong danh sách thiết bị. Phiên đang dùng cũng có thể bị revoke.
- Logout toàn bộ tăng `User.sessionVersion` bền vững trong Mongo trước khi xóa
  session Redis; mỗi request đã xác thực kiểm tra version hiện hành. Nhờ đó request
  refresh đang bay không hồi sinh quyền sau logout-all. Nếu Mongo/Redis lỗi, fail
  closed; không fallback memory. Login đồng thời chỉ hợp lệ nếu phát phiên dựa trên
  version mới sau thời điểm logout-all commit.
- Revoke từng phiên cần tombstone/atomic fence với refresh đang bay; lưu tombstone
  tới absolute expiry, test session cũ không được ghi lại sau revoke.
- Logout chỉ dùng POST, xóa cookie đúng path/flags. Không tuyên bố có thể hủy thao
  tác nghiệp vụ đã được server chấp nhận trước thời điểm revoke.
- Mutation yêu cầu CSRF token và Origin khớp allowlist; Origin thiếu thì kiểm tra
  Referer hợp lệ, thiếu cả hai thì từ chối đối với browser mutation. OAuth callback
  GET dùng state/nonce và không bị ép qua mutation policy.
- Response auth đặt `Cache-Control: no-store`; không log Cookie, Authorization,
  OAuth code, state, nonce, CSRF, session credential hoặc số điện thoại rõ.
- `REQUIRE_PHONE_OTP=false` chỉ local/test. Staging/production bật true; Stage 2
  cho phép onboarding/session management nhưng chưa cấp quyền pilot cho UNVERIFIED.
  Stage 3 sẽ bổ sung OTP, role và policy đầy đủ.

## 6. Contract dự kiến

Tất cả endpoint dưới `/api/v1`. Tên operation/schema được sinh từ backend; bảng
dưới là thiết kế, chưa phải API đã có. Lỗi dùng envelope và requestId Stage 1.

| Method/path                               | Quyền                 | Kết quả                                                           |
| ----------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| GET `/auth/google`                        | Public, rate limited  | Redirect Google, lưu state/nonce/PKCE                             |
| GET `/auth/callback`                      | OAuth request hợp lệ  | Đổi code, tạo session, redirect nội bộ                            |
| GET `/auth/csrf`                          | Anonymous/session     | Token CSRF gắn session, no-store                                  |
| GET `/auth/session`                       | Session               | User tối thiểu, onboarding state, thời hạn; 401 nếu thiếu/hết hạn |
| POST `/auth/refresh`                      | Session + CSRF/Origin | Rotate cookie/token; 401 nếu không còn hợp lệ                     |
| PUT `/auth/phone`                         | Session + CSRF/Origin | Nhập/chỉnh số của chính mình, UNVERIFIED                          |
| GET `/auth/sessions`                      | Session               | Danh sách phiên với public ID và nhãn thiết bị đã sanitize        |
| DELETE `/auth/sessions/{deviceSessionId}` | Owner + CSRF/Origin   | 204; 404 cho ID không thuộc user                                  |
| POST `/auth/logout`                       | CSRF/Origin           | 204, kết thúc phiên và xóa cookie                                 |
| POST `/auth/logout-all`                   | Session + CSRF/Origin | 204, revoke mọi phiên gồm phiên hiện tại                          |

Chốt status/error code qua contract test: 400 validation, 401 unauthenticated,
403 CSRF/Origin, 404 session không thuộc owner, 409 conflict, 429 rate limited,
503 dependency unavailable. OAuth browser failure redirect tới trang lỗi cố định
với mã lỗi allowlist, không phản chiếu provider error description.

## 7. Work breakdown và thứ tự PR

Mỗi work item có owner/reviewer do nhóm gán; auth/CI qua PR có reviewer ngoài người
triển khai. Không tự nhận các mục dưới đã hoàn thành vì có kế hoạch.

| ID    | Nội dung và sản phẩm                                                                              | Phụ thuộc      | Hoàn thành khi                                                            |
| ----- | ------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| S2-00 | Đóng gap Stage 1: toolchain, Docker, fail-on-skip IT, fresh-start drill                           | Stage 1 source | Root gates xanh; report IT không skip; API/worker/web healthy             |
| S2-01 | Export OpenAPI từ runtime; generator pin version; sinh TS operations và drift check toàn contract | S2-00          | Thêm/sửa operation chưa regenerate làm CI đỏ; hai lần generate không diff |
| S2-02 | Identity model, repository ports, migration mới và concurrency test                               | S2-00          | Callback race chỉ tạo một user/identity; rollback không orphan            |
| S2-03 | Security chain, Google OIDC/PKCE, callback và startup config guards                               | S2-02          | Test state/nonce/claims/replay/fixation đều đạt                           |
| S2-04 | Redis session, expiry, rotation, danh sách/revoke/logout-all                                      | S2-03          | Multi-instance và refresh/revoke race đạt trên Redis thật                 |
| S2-05 | CSRF/Origin/CORS, error handlers, rate limit, redaction                                           | S2-03, S2-04   | Negative security matrix đạt; worker không cần Google secret              |
| S2-06 | Phone onboarding UNVERIFIED và session DTO                                                        | S2-02, S2-05   | Không mass assignment hoặc merge bằng phone/email                         |
| S2-07 | Web login, onboarding, thiết bị và trạng thái lỗi                                                 | S2-01, S2-06   | Dùng generated client; keyboard/mobile; token không vào storage JS        |
| S2-08 | OIDC test server riêng trong test, browser E2E và CI gate                                         | S2-07          | Hai browser context, refresh/logout/revoke và dependency failure đạt      |
| S2-09 | Google thật, README/env mẫu, bằng chứng và handoff Stage 3                                        | S2-08          | Callback đã đăng ký chạy thật; root gates/review/CI đạt                   |

Rate limit S2-05 giới hạn login/callback/refresh theo IP đã qua trusted proxy và
user/session khi có; trả Retry-After. Không mở rộng sang thuật toán OTP Stage 3.
Dependency mới ưu tiên BOM; xác minh Spring Session/Security với Boot đang khóa.
Không nâng stack toàn dự án như một phần ngầm của auth.

## 8. Web và UX

- `/login`: nút Google, trạng thái đang chuyển hướng, người dùng hủy hoặc lỗi
  provider, thử lại có chủ đích; không lộ lỗi kỹ thuật.
- `/onboarding/phone`: label, validation tại client và server; thông báo rõ chưa
  xác minh, submit chống lặp; không hiển thị trạng thái đã xác minh giả.
- `/account/sessions`: phiên hiện tại, thời gian hoạt động, logout và revoke.
  Nhãn thiết bị chỉ mang tính mô tả, không phải bằng chứng danh tính thiết bị.
- Tải session khi vào app; 401 xóa state người dùng, quay về login; 503 hiển thị
  mất kết nối và retry, không coi là logout thành công.
- Cookie quản lý bởi trình duyệt; session credential không dùng localStorage.
  CSRF token chỉ trong memory, nạp lại sau login/rotation. Không tự động retry
  mutation khi chưa biết request trước đã được thực thi hay chưa.
- Nội dung auth riêng tư không qua cache SSR dùng chung; kiểm thử back navigation
  và tab khác sau logout. Client state chỉ hỗ trợ UX, server là nơi kiểm tra quyền.

## 9. Ma trận kiểm thử bắt buộc

| Nhóm       | Ca kiểm thử                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| OIDC       | Happy path; user hủy; state/nonce sai hoặc thiếu; issuer/audience/expiry/signature sai; callback replay; challenge S256 |
| Identity   | Hai login mới đồng thời; cùng sub đổi email; khác sub cùng email không merge; Mongo rollback                            |
| Session    | Fixation; idle/absolute expiry; rotation invalidates old ID; hai API instance; refresh race; Redis restart/outage       |
| Revoke     | Owner/IDOR; revoke phiên hiện tại/khác; logout-all; refresh đang bay không hồi sinh session                             |
| Browser    | Cookie flags; CORS origin sai; mutation thiếu CSRF/Origin; open redirect; không cache dữ liệu user                      |
| Onboarding | E.164; input sai; client gán verified/role; trùng số chưa xác minh không merge; production vẫn khóa pilot               |
| Privacy    | Log/envelope/URL không có credential hoặc phone; public session ID không sử dụng để xác thực được                       |
| Runtime    | Worker không mở HTTP hoặc khởi tạo OAuth client; production thiếu secret/unsafe config phải fail startup                |
| Contract   | Paths, required, enum, nullable, security scheme, status codes và operation TS khớp backend                             |

Unit test dùng Clock inject. Integration test dùng Mongo replica set và Redis thật;
không chấp nhận skip để đóng gate. Browser CI dùng OIDC test server với signing key
tổng hợp, đi qua redirect/token/JWKS thực; không dùng header bypass. Google thật là
manual acceptance riêng, không nhét credential Google vào CI hoặc repo.

## 10. Nghiệm thu, vận hành và rollback

Chạy `pnpm check`, Maven `verify` không skip, Compose fresh start, `pnpm dev` và
browser E2E. Lưu commit, CI URL, số test pass/fail/skip, cấu hình môi trường không
nhạy cảm, kết quả Google thật và reviewer. Hiện toàn bộ S2-00 đến S2-09: Pending.

Google Cloud OAuth client, consent screen, callback URI và domain staging cần owner
cung cấp khi làm S2-09; không chặn model/test bằng dữ liệu tổng hợp. Không yêu cầu
người dùng gửi secret trong chat; cấu hình qua environment/secret manager.

Metrics chỉ dùng nhãn hữu hạn: login success/failure code, refresh/revoke count,
Redis latency và session failure; không gắn userId/phone/token làm label. Cảnh báo
trên failure rate; log audit dùng ID nội bộ với retention được review.

Rollback giữ collection identity và migration đã áp dụng; sửa bằng migration kế
tiếp, không drop dữ liệu. Session serializer thay đổi không tương thích phải có
chiến lược namespace/version và đăng nhập lại có chủ đích. Không rollback về bản
API mất authentication mà vẫn mở endpoint riêng tư ra public.

Handoff Stage 3: phone UNVERIFIED, user/session identity ổn định, policy điểm vào rõ,
config OTP gate bật ở production; chưa tuyên bố user đủ điều kiện pilot.

## 11. Nguồn kỹ thuật để triển khai

- [ADR auth của dự án](../docs/architecture/adr/0006-auth-and-session-model.md).
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect):
  kiểm tra token và dùng sub làm định danh ổn định.
- [Spring Security authorization grants](https://docs.spring.io/spring-security/reference/7.0/servlet/oauth2/client/authorization-grants.html):
  cấu hình authorization request và PKCE; đối chiếu version thực tế do BOM resolve.
- [Spring Session API](https://docs.spring.io/spring-session/reference/api.html):
  Redis indexed repository và tra session theo principal.

Các timeout, endpoint và concurrency fence là đề xuất của dự án; không phải mặc
định được bảo đảm sẵn bởi các thư viện trên.
