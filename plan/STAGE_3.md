# STAGE 3 — OTP và phân quyền tài khoản

Ngày lập: 06/10/2026. Baseline: `03a35c8` trên `main`.

Trạng thái: Kế hoạch chi tiết; chưa triển khai Stage 3. `PLAN_MASTER.md` và ADR
Accepted có ưu tiên cao hơn runbook này. Timeout, hạn mức và API bổ sung bên dưới
là đề xuất triển khai cần review trong PR; không phải chức năng đã nghiệm thu.

## 1. Mục tiêu và phạm vi

Sau stage này, người đăng nhập Google có thể xác minh quyền sở hữu số di động
Việt Nam, nhận quyền phù hợp từ server và truy cập API theo policy rõ ràng. Một
số đã xác minh chỉ thuộc một tài khoản. Không thể brute-force mã, tự nâng quyền,
vượt hạn mức bằng nhiều phiên hoặc dùng provider giả trong môi trường hosted.

Trong phạm vi:

- OTP challenge, gửi/xác minh/resend, rate limit đa chiều và chi phí gửi có giới hạn.
- Port `OtpProvider`, fake chỉ local/test, adapter thật và contract test provider.
- Unique verified phone, đổi số và hủy challenge cũ an toàn khi có concurrency.
- Principal Spring Security, method authorization, role và policy nền.
- Web onboarding OTP, trạng thái lỗi, contract sinh tự động và test E2E.
- Audit xác minh/cấp quyền tối thiểu và runbook xử lý sự cố.

Ngoài phạm vi: phone login, password recovery, account merge, eKYC, duyệt xe/tài
xế, admin dashboard, policy cộng đồng/bạn bè/booking hoàn chỉnh, mobile, deploy
production. OTP chứng minh quyền nhận mã tại số điện thoại, không chứng minh danh
tính pháp lý hoặc điều kiện lái xe. SMS không được coi là MFA chống phishing cho
quản trị viên; chính sách step-up admin cần được chốt trước pilot.

## 2. Kết quả rà soát và gate đầu vào

| Hiện trạng                             | Bằng chứng                                            | Hệ quả cho Stage 3                                                     |
| -------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Google và opaque session đã có         | AuthService, RedisSessionStore, SecurityConfiguration | Tái sử dụng login/session; không thêm cơ chế login khác                |
| Account chỉ có phoneStatus dạng string | Account, MongoAccountStore                            | Thêm kiểu trạng thái, version và evidence xác minh                     |
| Nhập số luôn đặt UNVERIFIED            | AccountStore.phone                                    | Phải chặn hạ VERIFIED ngầm khi gửi lại cùng số; thiết kế đổi số rõ     |
| Controller tự require session          | AuthController; auth paths permitAll                  | Đưa authentication vào filter, không chỉ gắn annotation role           |
| SecurityContext không persist          | NullSecurityContextRepository                         | Tạo principal từ cookie cho từng request, không thêm session song song |
| OTP flag chỉ kiểm tra startup          | AuthSettings không giữ flag làm runtime policy        | Thêm typed policy và enforcement server-side                           |
| PhoneNumber đã chuẩn hóa E.164         | PhoneNumberTest                                       | Dùng chung canonicalization cho index, rate limit và provider          |
| Contract pipeline đã có                | RuntimeContractTest, api:generate                     | Mọi endpoint/schema mới phải qua pipeline hiện có                      |
| Stage 2 chưa đóng                      | STAGE_2 mục 10                                        | Docker IT, OIDC/browser E2E và Google thật vẫn là gate còn thiếu       |

Được viết model, unit test và adapter contract trong lúc xử lý gate Stage 2.
Không đóng Stage 3 hoặc bật cho người dùng thật trước khi Stage 2 được nghiệm thu.
Không dùng `-DskipITs`, push thành công hoặc CI chưa được đọc làm bằng chứng đạt gate.

## 3. Các quyết định phải chốt trước implementation

| Quyết định            | Mặc định đề xuất                                                | Cách chốt / điều kiện chặn                                                                              |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Nhà cung cấp SMS      | Chưa chọn                                                       | So capability, sandbox, delivery, timeout, idempotency và chi phí; chặn adapter thật, không chặn domain |
| Ai tạo/kiểm tra mã    | Dike sinh mã và provider chỉ vận chuyển                         | Nếu provider quản lý challenge thì sửa thiết kế bằng ADR, không trộn hai nguồn trạng thái               |
| Luồng đổi số VERIFIED | Google re-auth mới trong 5 phút; thu hồi quyền xác minh khi đổi | Review trước code đổi số; không tạo SMS recovery                                                        |
| Hạn mức và ngân sách  | Mục 7                                                           | Owner vận hành xác nhận trước provider thật; không đoán đơn giá                                         |
| Quyền admin đầu tiên  | Lệnh vận hành offline, account ID rõ, audit, không seed tự động | ADR/review riêng trước hosted use                                                                       |
| Ý nghĩa fake OTP      | Evidence SIMULATED, UI gắn nhãn thử nghiệm                      | Không được nâng dữ liệu fake thành VERIFIED thật khi đổi môi trường                                     |

Không yêu cầu secret trong chat/repo. Client ID, SMS key, pepper và encryption key
đi qua environment hoặc secret manager. Runbook phải ghi tên biến, không ghi giá trị.

## 4. Ownership và kiến trúc

`identity.domain`: phone/status, challenge transition, effective permissions.
`identity.application`: OtpService, AccountAccessService, provider/store/rate-limit
port. `identity.infrastructure`: Mongo, Redis limiter, provider adapter, crypto.
`identity.api`: DTO, controller, cookie authentication filter và security wiring.

Public named interface chỉ cung cấp AccountAccessSnapshot cần thiết: accountId,
accountStatus, effective authorities, verification evidence và authorizationVersion.
Không xuất phone, challenge hoặc repository cho module khác.

Policy owner/resource thuộc module sở hữu resource. Stage 3 tạo interface và test
điểm gọi policy; không tạo class trả true giả cho friendship/community/block.
Module `trust` sở hữu audit/admin theo tài liệu kiến trúc: identity ghi event không
chứa OTP qua outbox cùng transaction; trust ghi projection idempotent. Không đưa
business audit entity vào shared. Auth failure metrics không cần domain event.

## 5. Dữ liệu và index

| Model             | Trường đề xuất                                                                                                                                                                              | Ràng buộc                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| User mở rộng      | phoneE164, phoneStatus, phoneVersion, verifiedAt, verificationEvidence, accountStatus, assignedRoles, authorizationVersion                                                                  | version cho CAS; roles/verifiedAt chỉ server ghi                   |
| OtpChallenge      | id, userId, deviceSessionId, phoneVersion, phoneKey, purpose, generation, status, codeMac, keyVersion, attemptsUsed, expiresAt, resendAfter, requestKeyHash, createdAt, consumedAt, purgeAt | Owner/session/purpose binding; id ngẫu nhiên không phải credential |
| Delivery metadata | challengeId, dispatchId, deliveryState, providerReference, errorCategory                                                                                                                    | Không lưu provider payload hoặc SMS text nguyên bản                |
| Auth audit event  | eventId, actorId, targetId, action, outcome, occurredAt, requestId                                                                                                                          | Không phone/code/token; reason code hữu hạn                        |

`phoneKey` là HMAC của canonical phone với key riêng cho rate limit/log correlation;
không dùng SHA-256 phone thuần vì không gian số nhỏ. Phone đầy đủ chỉ lưu ở user
và payload gửi đã mã hóa nếu có queue. CodeMac dùng HMAC-SHA-256 với pepper riêng,
đầu vào gồm challengeId, userId, phoneVersion, purpose, generation và mã; so sánh
constant-time. Không lưu hoặc log OTP dạng rõ, kể cả outbox và fixture snapshot.

Index migration mới, không sửa checksum migration Stage 1/2:

- Partial unique `users.phoneE164` khi `phoneStatus=VERIFIED` và phone là string.
  UNVERIFIED/NONE không unique. Evidence thật/giả không làm yếu unique invariant.
- Challenge index `(userId, phoneVersion, createdAt)` và unique `(userId,
deviceSessionId, requestKeyHash)` cho request idempotency còn trong retention.
- TTL `purgeAt` cho challenge; TTL chỉ dọn dữ liệu, không quyết định mã còn hiệu lực.
- Trường thiếu ở user cũ được map mặc định an toàn: MEMBER, ACTIVE, version 0,
  evidence NONE. Không tự chuyển UNVERIFIED thành VERIFIED.

Preflight kiểm tra duplicate VERIFIED trước tạo unique index; có conflict thì dừng
migration và báo aggregate count, không tự merge/xóa tài khoản. Chứng minh index
thật tồn tại bằng integration test, không chỉ gọi ensureIndex.

## 6. State machine và transaction

### 6.1. Nhập và đổi số

- NONE → UNVERIFIED khi nhập số hợp lệ. Gửi lại cùng canonical number là no-op;
  không làm mất VERIFIED hoặc tăng phoneVersion vô ích.
- Số khác: tăng phoneVersion, đặt UNVERIFIED, xóa verifiedAt/evidence, tăng
  authorizationVersion và vô hiệu challenge cũ trong cùng Mongo transaction.
- Nếu số cũ VERIFIED, yêu cầu Google re-auth trong 5 phút, state/nonce/PKCE như
  Stage 2 và bind kết quả vào đúng user/session. Không tự đổi user nếu Google chọn
  account khác. Sau đổi số thu hồi VERIFIED_MEMBER và quyền phụ thuộc; không giữ
  quyền tài xế hiệu lực chỉ vì assignedRoles còn APPROVED_DRIVER.
- Số cũ được giải phóng bởi unique index sau commit. Không tự phục hồi số cũ nếu
  xác minh số mới thất bại; user có thể đổi lại và xác minh lại. UI phải nói rõ.

### 6.2. Challenge và gửi mã

`PENDING_DELIVERY → ACTIVE → CONSUMED`; nhánh cuối gồm `SUPERSEDED`, `EXPIRED`,
`LOCKED`, `DELIVERY_FAILED`. Delivery timeout không rõ provider đã nhận hay chưa
là `DELIVERY_UNKNOWN`, không tự tạo mã mới hoặc báo gửi thành công.

Luồng request:

1. Session hợp lệ, Origin/CSRF, account ACTIVE, phoneVersion hiện hành.
2. Reserve đồng thời các quota; kiểm tra cooldown theo user/phone, không chỉ device.
3. Sinh 6 chữ số bằng SecureRandom, giữ leading zero; tạo challenge mới và vô hiệu
   generation cũ trong transaction có CAS trên User.phoneVersion và challengeGeneration.
4. Gọi provider ngoài transaction với dispatchId/idempotency key. Bản đầu gửi đồng
   bộ có timeout; OTP rõ chỉ trong memory và request TLS tới provider.
5. Provider nhận: chuyển ACTIVE có CAS; nếu phone/generation đã đổi thì giữ terminal
   state. SMS đến muộn có thể chứa mã không còn hợp lệ; UI hướng dẫn dùng mã mới nhất.
6. Lỗi xác định: DELIVERY_FAILED. Timeout/crash: UNKNOWN/PENDING được job reconcile
   chuyển terminal sau deadline; không gửi lại mù nếu provider thiếu idempotency.

Resend là request mới sau cooldown và generation mới; quota và tổng verify budget
không reset vì resend. Cùng idempotency key + payload trả challenge cũ, không gửi
SMS thứ hai; cùng key khác payload trả 409. Response mất sau dispatch vẫn có thể
đọc lại challenge. Không retry SMS tự động ở client.

Không đưa OTP vào generic outbox để tiện retry. Nếu cần durable delivery queue sau
spike, phải mã hóa payload bằng key tách khỏi DB, có retention/xóa sau gửi và ADR;
đây không phải yêu cầu ngầm của implementation đầu tiên.

### 6.3. Xác minh và concurrency

Challenge chỉ verify khi ACTIVE, chưa hết hạn theo server Clock, attempts còn,
owner/deviceSessionId/phoneVersion/generation đều khớp. Cookie rotation giữ
deviceSessionId nên không làm mất challenge; thiết bị khác không được verify hộ.

Trong Mongo transaction:

1. Đọc challenge và user/version hiện hành; kiểm tra mã bằng HMAC.
2. Mã sai: atomic increment attempts, LOCKED khi đạt ngưỡng; commit trước trả lỗi.
   Không throw exception làm rollback lượt thử sai. Transaction conflict retry
   hữu hạn phải đọc lại attempts mới, không cho nhiều request dùng chung lượt cuối.
3. Mã đúng: CAS consume challenge và cập nhật phone VERIFIED/evidence/verifiedAt,
   tăng authorizationVersion, ghi outbox audit cùng transaction.
4. Unique verified phone là trọng tài cuối. Nếu trùng, rollback toàn bộ; trả thông
   báo chung không lộ owner. Consume/terminate challenge xung đột ở transaction
   riêng có CAS để tránh lặp không giới hạn; không đổi account đang sở hữu số.

Hai user xác minh cùng số: đúng một commit. Hai verify cùng mã: một side effect;
retry cùng request key trả kết quả thành công đã lưu cho đúng owner, key khác
nhận trạng thái terminal. TTL chậm, resend/phone edit/logout race không được làm
mã cũ valid lại. Request đã được chấp nhận trước logout có thể hoàn tất; request
bắt đầu sau revoke phải bị chặn, không hứa rollback hoạt động đã commit.

## 7. Hạn mức, lifetime và anti-abuse

Các số sau là mặc định thiết kế, không phải SLA/provider limit; typed config có
validation và Clock inject. Hosted không cho cấu hình vô hạn/âm hoặc tắt limiter.

| Quy tắc                  | Mặc định đề xuất                                                        |
| ------------------------ | ----------------------------------------------------------------------- |
| OTP lifetime             | 5 phút từ tạo challenge, gửi chậm không kéo dài                         |
| Số lần sai/challenge     | 5; đạt ngưỡng thì LOCKED                                                |
| Cooldown resend          | 60 giây theo user và canonical phone                                    |
| Gửi theo user / phone    | Mỗi chiều 5 lần/giờ, 10 lần/24 giờ                                      |
| Gửi theo deviceSessionId | 5 lần/giờ                                                               |
| Gửi theo IP              | 20 lần/giờ, 100 lần/24 giờ; hiệu chỉnh cho NAT pilot                    |
| Verify theo user / phone | Mỗi chiều 20 lần/15 phút, bao gồm challenge ID không hợp lệ             |
| Verify theo device / IP  | 20 / 100 lần trong 15 phút                                              |
| Challenge retention      | purgeAt tối đa 24 giờ sau terminal/expiry; xóa codeMac sớm khi terminal |
| Audit retention đề xuất  | 90 ngày cho metadata tối thiểu; owner review trước pilot                |

Redis atomic script reserve các bucket độc lập; không dùng duy nhất key ghép
IP+user vì có thể phân tán để vượt hạn mức. Fail-closed khi limiter lỗi. Redis
single primary là assumption hiện tại; cluster cần thiết kế slot riêng trước dùng.
Hạn mức ngày/chi phí cần ledger bền vững trong Mongo trước dispatch để Redis restart
không reset ngân sách gửi. Không hoàn quota tự động khi timeout không rõ kết quả.

Trusted proxy allowlist quyết định IP; không tin X-Forwarded-For tùy ý. Device lấy
từ server session, không từ header client. Thêm global daily cap và kill switch
send; đạt cap trả 503/429 theo policy, verify mã đã gửi vẫn được phép nếu an toàn.
429 kèm Retry-After theo cửa sổ thực. Trả lỗi đồng nhất, không có endpoint dò số
đã đăng ký. Chi tiết phone conflict chỉ xuất hiện sau proof OTP và không lộ user.

## 8. Provider, fake và cấu hình môi trường

Port đề xuất: `send(OtpDeliveryRequest) → ACCEPTED | REJECTED | UNKNOWN`; DTO
không rò SDK type. Timeout, error mapping và idempotency phải có test cho adapter.
Không chốt vendor trước capability spike; nếu provider trả ACCEPTED chỉ có nghĩa
đã nhận yêu cầu, không hứa SMS đã tới. Callback delivery không bao giờ xác minh user.

- Fake bean chỉ profile local/test và environment local/test; hosted bật fake phải
  fail startup, kể cả cấu hình profile kết hợp sai. Worker cũng áp dụng guard.
- Local fake nhận mã qua test harness/in-memory local tool giới hạn loopback; không
  trả mã trong API chung hoặc log. Hosted không đăng ký route/tool lấy mã.
- Fake tạo evidence SIMULATED, UI ghi “Xác minh thử nghiệm”. Hosted policy yêu cầu
  REAL evidence; không migrate trạng thái thử sang thật.
- `REQUIRE_PHONE_OTP=false` chỉ local/test: cho chạy luồng thử qua policy có nhãn,
  không set phoneStatus VERIFIED và không tự gán VERIFIED_MEMBER.
- Biến dự kiến: `DIKE_OTP_PROVIDER`, provider secret, HMAC pepper/key version,
  rate-key pepper, TTL/attempt/cooldown/quota, send-enabled, daily-cap,
  `REQUIRE_PHONE_OTP`. Kiểm tra đầy đủ trước dispatch; không log object config secret.

## 9. Authentication và authorization

CookieAuthenticationFilter đọc DIKE_SESSION, dùng AuthService.require, kiểm tra
accountStatus/sessionVersion, tạo Authentication đã xác thực với authority lấy từ
account hiện tại. Đặt vào SecurityContext mới cho request sau SecurityContextHolderFilter,
trước Anonymous/AuthorizationFilter; context được clear cuối request, không persist
Google token hoặc custom principal vào OAuth HttpSession.

Public allowlist chỉ health tối thiểu và Google start/callback. API onboarding,
session và OTP yêu cầu authenticated MEMBER; không dùng permitAll toàn `/auth/**`.
Giữ OAuth callback exemption đúng luồng state/nonce. CSRF và Origin áp dụng mọi
mutation dùng cookie, kể cả API ngoài auth trong stage sau; không chỉ check prefix.
Thiếu session trả 401; có session nhưng thiếu quyền trả 403; lỗi dependency 503.

| Authority       | Điều kiện hiệu lực                                           | Không tự suy ra                                      |
| --------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| MEMBER          | Google identity hợp lệ, account ACTIVE                       | Không đồng nghĩa phone đã xác minh                   |
| VERIFIED_MEMBER | MEMBER + phone VERIFIED + evidence được môi trường chấp nhận | Không đồng nghĩa eKYC hoặc driver                    |
| APPROVED_DRIVER | VERIFIED_MEMBER + driver approval còn hiệu lực               | Chỉ model/test trong Stage 3; workflow duyệt Stage 5 |
| MODERATOR       | Assignment server-side có scope                              | Không có quyền đọc mọi dữ liệu hoặc cấp admin        |
| ADMIN           | Assignment server-side qua vận hành được audit               | Không mặc định bỏ owner/privacy policy               |

MEMBER/VERIFIED_MEMBER là quyền suy ra; privileged assignments không nhận từ DTO
onboarding. Default deny, không dùng role hierarchy ngầm ADMIN → mọi quyền.
Method security trên application entrypoint; policy service nhận principal và
resource từ server, không nhận ownerId/role đáng tin từ request body.

V1 đọc trạng thái quyền từ Mongo mỗi request, chưa cache role. Thay đổi role,
phone hoặc lock tăng authorizationVersion; yêu cầu quyền mới có hiệu lực ngay ở
request tiếp theo trên tất cả phiên. Account bị khóa từ chối business action,
giữ cơ chế logout/xóa cookie tối thiểu, không mở quyền dữ liệu. Persisted role enum
không có workflow cấp tự do từ web. CLI bootstrap admin: explicit account ID,
reason, operator, dry-run, audit và idempotency; không truyền secret qua command line.

## 10. API và trải nghiệm web

Contract bổ sung dưới `/api/v1`; đây là thiết kế cần chốt trước code.

| Endpoint                              | Input chính                            | Kết quả                                                             |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| PUT `/auth/phone`                     | phone, expectedPhoneVersion            | User mới; same-number no-op; 409 nếu version stale                  |
| POST `/auth/otp`                      | purpose, phoneVersion; Idempotency-Key | 202 challengeId, deliveryState, expiresAt, resendAfter, maskedPhone |
| GET `/auth/otp/{challengeId}`         | Owner + device session                 | Challenge status tối thiểu; không code/MAC/provider secret          |
| POST `/auth/otp/{challengeId}/verify` | code, Idempotency-Key                  | User/access snapshot; 400 chung nếu code invalid/expired            |
| DELETE `/auth/otp/{challengeId}`      | Owner + CSRF/Origin                    | 204 cancel, terminal idempotent                                     |
| GET `/auth/session`                   | Cookie                                 | Bổ sung phoneVersion, evidence, authorities, capabilities           |

Resend dùng POST `/auth/otp` với key mới; không tạo nhiều API resend khác nhau.
Không nhận phone mới trong verify; mã chỉ áp dụng số đã bind. Schema code là string
6 digit, không integer. Request body unknown field bị reject, giữ policy Stage 2.
Owner mismatch trả 404; version/purpose conflict 409; rate 429; provider outage 503.
Auth response no-store. Contract đồng thời mô tả 401/403/409/429/503 và header.

Web `/onboarding/phone`: nhập số → xác nhận masked phone → gửi → nhập mã → thành
công. Có resend countdown theo timestamp server, paste/autocomplete one-time-code,
label/error accessible, nút busy, hủy/đổi số. Reload đọc status, không gửi lại SMS.
Không lưu mã trong URL/localStorage/analytics. Khi đổi số VERIFIED hiển thị rõ mất
quyền xác minh và yêu cầu re-auth; không đánh đồng SMS sent với verification success.

401 chuyển login; 403 tải lại trạng thái quyền/CSRF và yêu cầu thao tác lại; 429
hiển thị thời gian chờ; timeout hiển thị chưa xác nhận kết quả, đọc challenge trước
khi cho resend. Cập nhật quyền trên tab khác bằng cơ chế broadcast Stage 2; server
vẫn quyết định quyền. Có nhãn thử nghiệm khi dùng fake hoặc bypass local.

## 11. Work breakdown và dependency

Mỗi hàng tương ứng issue/PR review được; owner/reviewer do nhóm gán, hiện TBD.
Không gom provider, security wiring và migration vào một PR không thể review.

| ID    | Sản phẩm                                                                   | Phụ thuộc             | Acceptance riêng                                                       |
| ----- | -------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| S3-00 | Audit/đóng gate Stage 2, baseline CI và toolchain                          | Stage 2               | Full verify không skip, Google/browser evidence; blocker ghi rõ        |
| S3-01 | ADR OTP transport, state machine, budget, re-auth và admin bootstrap       | Scan                  | Model/API/security decisions review; provider selection riêng          |
| S3-02 | Typed account/phone state, version và migration                            | S3-01                 | Partial unique thật; backfill không nâng quyền; rollback test          |
| S3-03 | Cookie principal, authorities, method security và global mutation boundary | S3-02                 | 401/403 đúng, context không rò giữa request, regression OAuth          |
| S3-04 | OtpProvider port, fake guarded, typed secret/config                        | S3-01                 | Hosted fake fail startup, fake không lộ qua API/log                    |
| S3-05 | Challenge store, HMAC, issue/resend/idempotency                            | S3-02, S3-04          | State transition và generation race test                               |
| S3-06 | Redis quota, Mongo budget ledger, kill switch                              | S3-05                 | Multi-instance không vượt cap; Redis restart không reset daily budget  |
| S3-07 | Verify transaction, unique phone và audit outbox                           | S3-05, S3-06          | Hai user/một số chỉ một thành công; mã không replay                    |
| S3-08 | Đổi số/re-auth, quyền tức thời trên mọi phiên                              | S3-03, S3-07          | Old challenge/old authority không dùng lại được                        |
| S3-09 | Adapter provider thật, timeout/idempotency/sandbox                         | S3-04, S3-06 + vendor | Contract tests và delivery evidence không chứa secret                  |
| S3-10 | API/OpenAPI/generated client và web OTP                                    | S3-03, S3-07          | Required fields/enum/status/header đúng; responsive/accessibility      |
| S3-11 | Policy/admin bootstrap audit tối thiểu                                     | S3-03                 | Không tự nâng role; dry-run/idempotent provisioning; no blanket bypass |
| S3-12 | Docker IT, OIDC/browser E2E, failure injection                             | S3-08 đến S3-11       | Ma trận mục 12 đạt, không skip, report commit chính xác                |
| S3-13 | README/env/runbook và handoff Stage 4                                      | S3-12, S3-00          | Reviewer + CI + provider thật đạt; không còn blocker security          |

Thứ tự tích hợp: decisions → schema → security principal → fake/challenge → quota
→ verify → phone change → provider → web → E2E/handoff. Adapter thật có thể chuẩn
bị song song với web sau khi contract đã ổn định, không cần nhiều agent để thực hiện.

Ước lượng sơ bộ: 12–18 ngày công kỹ thuật và 3–5 ngày công kiểm thử/review cho
scope trên; chưa tính khôi phục môi trường, thủ tục SMS/brandname hoặc chờ provider.
Đánh giá lại sau S3-01 và sau concurrency tests; đây không phải cam kết ngày pilot.
Nếu chậm, giảm polish/admin tiện ích trước; không cắt unique constraint, limiter,
secret protection hoặc test quyền để đóng stage.

## 12. Ma trận kiểm thử

| Nhóm          | Test bắt buộc                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Domain/crypto | E.164, leading-zero OTP, boundary expiry, HMAC binding, pepper mismatch, không plaintext                           |
| Rate limit    | User/phone/device/IP độc lập; nhiều instance; resend không reset; spoof XFF; Redis down/restart; global cap        |
| Concurrency   | Hai user cùng phone; hai verify cùng mã; lượt sai cuối đồng thời; resend/verify; edit phone/verify; callback stale |
| Atomicity     | Consume/user/outbox rollback cùng nhau; duplicate index rollback; retry conflict không reset attempts              |
| Delivery      | Reject/timeout/unknown, crash trước/sau send, retry cùng key không gửi đôi; SMS cũ không valid                     |
| Security      | CSRF/Origin, owner/session binding, body mass assignment, IDOR, role downgrade, locked user, context leak          |
| Policy        | MEMBER bị chặn quyền verified; VERIFIED không thành driver; moderator sai scope; admin không bỏ privacy            |
| Environment   | Hosted fake/bypass/missing pepper fail; fake evidence không thành REAL; worker startup đúng                        |
| Privacy       | Request/response/log/metric/outbox không code hoặc số rõ; scan report không chứa fixture secret thật               |
| UI/E2E        | Google → nhập số → gửi → sai → resend → đúng; reload; 429; offline; đổi số; tab/thiết bị khác                      |
| Regression    | Refresh/revoke/logout-all Stage 2; contract full diff; architecture rules; fresh-clone gate                        |

Unit test dùng Clock/random/provider port inject. Mongo replica set và Redis thật
cho IT; dùng latch/barrier để thực sự đua, không chỉ chạy tuần tự. Browser test dùng
OIDC server riêng trong test và SMS capture trong test harness, không demo header
hoặc endpoint production trả mã. E2E fake và acceptance SMS thật là hai bằng chứng
khác nhau; test với số thật cần người sở hữu số đồng ý và môi trường được duyệt.

Root gate: `pnpm check`, `mvnw verify`, full contract parity và browser E2E. Ghi số
test pass/fail/skip; Docker vắng mặt phải làm gate đỏ. CI chạy trên đúng commit PR.

## 13. Vận hành, failure handling và rollback

Dashboard chỉ dùng nhãn hữu hạn: request/verify outcome, provider error category,
rate-limit dimension, pending/unknown age, dispatch count. Không phone/userId làm
metric label. Alert trên spike gửi, tỷ lệ lỗi, latency và approaching daily cap.
Owner chốt thresholds bằng sandbox/pilot dữ liệu tổng hợp trước production.

- SMS outage: ngừng send, giữ verify mã còn hiệu lực; UI không hứa thời gian phục hồi.
- Mongo lỗi: không issue/verify thành công, không gán role tạm trong Redis.
- Redis lỗi: chặn issue/verify theo policy fail-closed; không fallback limiter memory.
- Pepper rotation: keyVersion + cửa sổ hỗ trợ challenge còn hạn; compromise thì
  invalidate challenge và rotate key, không log mã để debug.
- Rollback app vẫn phải tôn trọng VERIFIED unique index/evidence và access policy.
  Không rollback về bản chỉ có permitAll mà mở business endpoint mới.
- Không drop unique index để giải quyết conflict; không sửa migration đã áp dụng.
- TTL/cleanup chỉ xóa challenge/payload theo retention; không xóa audit hoặc
  account để “sửa” lỗi provider. Cleanup idempotent và không gửi SMS lại.

## 14. Definition of Done và bằng chứng bàn giao

Tất cả S3-00 đến S3-13 hiện Pending. Chuyển Complete chỉ khi có:

- Commit/PR, owner/reviewer và CI URL; security/ADR qua review theo CONTRIBUTING.
- Test transaction/concurrency/authorization trên dependency thật và report không skip.
- Provider selection, env mẫu, secret rotation, send kill switch, quota/chi phí được chốt.
- Browser/OIDC E2E và acceptance provider thật; không coi mock là tích hợp thật.
- Không có secret/PII trong diff, test artifact hoặc log chia sẻ.
- README, module docs, API artifacts, ADR và master plan cập nhật khi scope thay đổi.

Handoff Stage 4: user identity ổn định, phone VERIFIED có provenance, authority và
owner policy có điểm vào rõ, session invalidation không thay đổi, audit event có
version. Profile/R2 dựa trên các quyền này; chưa tự mở quyền duyệt xe hoặc pilot.

## 15. Nguồn kỹ thuật

- [Master plan](PLAN_MASTER.md), [Stage 2](STAGE_2.md),
  [ADR auth/session](../docs/architecture/adr/0006-auth-and-session-model.md).
- [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html):
  giới hạn SMS, single-use OTP và anti-abuse; SMS phone verification của Dike không
  được quảng bá thành MFA chống phishing.
- [Spring Security authentication architecture](https://docs.spring.io/spring-security/reference/7.0/servlet/authentication/architecture.html):
  principal, Authentication và SecurityContext cho servlet request.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html):
  re-authentication cho thay đổi nhạy cảm và quản lý session.

Hạn mức, retention, schema và transaction protocol là đề xuất của dự án, cần test
và review; không được suy ra là đảm bảo mặc định từ các thư viện hoặc nguồn trên.
