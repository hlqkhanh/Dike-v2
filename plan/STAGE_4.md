# STAGE 4 — Hồ sơ, quyền riêng tư và R2

Ngày lập kế hoạch: 06/10/2026  
Baseline: `0232d6d` trên `main`  
Trạng thái: Planned — chưa bắt đầu triển khai

Tài liệu này là runbook triển khai Stage 4. `PLAN_MASTER.md`, ADR đã Accepted và
các contract đã phát hành có ưu tiên cao hơn. Mọi hạn mức, retention và quyết định
pháp lý trong tài liệu này là baseline kỹ thuật cần product/security/legal review;
không được tự coi là cam kết tuân thủ pháp luật.

## 1. Mục tiêu

Stage 4 tạo lát cắt hồ sơ và file an toàn đầu tiên của Dike:

- Thành viên quản lý tên hiển thị, giới thiệu ngắn và avatar.
- Thành viên đã đăng nhập xem hồ sơ cơ bản của người khác theo privacy policy;
  không lộ email, số điện thoại, object key, lịch hoặc địa chỉ.
- Consent được ghi theo phiên bản tài liệu, thời điểm và nguồn; không dùng một
  boolean có thể ghi đè làm bằng chứng duy nhất.
- Yêu cầu xóa tài khoản có state machine, re-authentication, thu hồi session,
  worker idempotent và audit không chứa PII.
- Browser upload trực tiếp bằng presigned URL vào vùng cách ly; backend kiểm tra
  ownership, loại file, kích thước và nội dung trước khi file được sử dụng.
- Avatar chỉ được public sau khi decode/re-encode an toàn. Hồ sơ xác minh luôn ở
  private bucket và chỉ được tải bằng signed URL ngắn hạn sau authorization.
- Upload dở, file bị thay thế và file đến hạn được cleanup có thể retry.

## 2. Điều kiện bắt đầu và preflight

Stage 4 phụ thuộc vào Stage 1–3 nhưng không được che khuất các gate còn thiếu:

| Điều kiện                                  | Hiện trạng tại baseline                                | Gate trước khi đóng Stage 4                                 |
| ------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------- |
| Identity, session, CSRF và owner principal | Đã có                                                  | Regression auth/session phải xanh                           |
| Phone/authority Stage 3                    | Code-complete với fake OTP                             | Không cấp quyền profile/file dựa trên client                |
| Docker IT                                  | Máy local vẫn có test bị skip                          | CI phải chạy Mongo replica set, Redis và MinIO thật         |
| SMS production                             | Tạm hoãn theo quyết định hiện tại                      | Không chặn phát triển local; vẫn chặn production pilot      |
| Object storage foundation                  | Chỉ có synchronous `put/get` và health check           | Mở rộng presign/head/copy/delete, không rò SDK khỏi adapter |
| Public/private bucket                      | MinIO local đã tạo hai bucket                          | CORS, lifecycle, access policy được kiểm tra tự động        |
| Profile hiện tại                           | `UserAccount` chỉ có display name/avatar URL từ Google | Migration không làm mất snapshot cũ                         |

Preflight bắt buộc:

1. Chạy `pnpm check`, `pnpm --filter @dike/web e2e` và `mvnw verify`; ghi rõ số
   test pass/fail/skip và commit được kiểm tra.
2. Chạy Compose từ trạng thái sạch, xác nhận hai bucket và CORS/lifecycle local.
3. Chốt ADR Stage 4 trước khi schema/API bị dùng bởi frontend.
4. Chốt owner cho product, backend, web, security/privacy và vận hành storage.
5. Không dùng file/giấy tờ người thật trong local, test, CI hoặc screenshot.

## 3. Phạm vi

### 3.1. Trong phạm vi

- Hồ sơ cơ bản: `displayName`, `bio`, avatar, verification badge hiện có và
  timestamps/version phục vụ optimistic concurrency.
- Đọc `/me/profile` và `/users/{userId}`; tìm kiếm tên chỉ khi policy cho phép và
  với dữ liệu projection tối thiểu.
- Privacy settings thuộc identity: khả năng được tìm thấy, khả năng người khác xem
  hồ sơ cơ bản và mặc định nhận message request cho Stage 12.
- Consent ledger cho Terms, Privacy Notice và xác nhận đủ 18 tuổi theo phiên bản.
- Yêu cầu xóa tài khoản và orchestration chỉ cho dữ liệu module identity sở hữu ở
  Stage 4; hợp đồng event để module tương lai tham gia cleanup.
- File metadata, presigned upload, complete/validate/promote, private download,
  replace/delete và cleanup.
- Avatar raster và private verification-document foundation cho Stage 5.
- OpenAPI, generated TypeScript client, web profile/settings, test và runbook.

### 3.2. Ngoài phạm vi

- eKYC, quyết định VERIFIED/REJECTED, duyệt xe hoặc quyền `APPROVED_DRIVER`.
- Danh sách bạn bè, block, policy `FRIENDS` hoàn chỉnh — Stage 6.
- Lịch, bài đăng, chuyến, review, cộng đồng và số liệu profile từ các module chưa có.
- Admin dashboard xem hồ sơ xác minh — Stage 5; Stage 4 chỉ tạo authorization port.
- Chỉnh sửa email/số điện thoại, account merge, phone login hoặc khôi phục account.
- Crop/editor ảnh nâng cao, video avatar, GIF động, SVG hoặc tài liệu Office.
- Tuyên bố GDPR/CCPA hoặc thời hạn pháp lý khi chưa có legal review.
- Production pilot với dữ liệu thật trước khi scanning, retention và incident
  response được nghiệm thu.

## 4. Quyết định cần khóa trong ADR 0013

Tạo `docs/architecture/adr/0013-profile-privacy-consent-and-file-lifecycle.md`.
ADR phải quyết định ít nhất:

1. Module `identity` sở hữu profile, privacy, consent, deletion request và file
   metadata; `shared` chỉ cung cấp object-storage port/adapter không chứa policy.
2. Upload dùng presigned `PUT`, không dùng presigned HTML `POST`; browser chỉ nhận
   URL cho một key ngẫu nhiên server tạo và một operation có hạn.
3. Mọi upload đi vào prefix cách ly trong private bucket. `complete` không đồng
   nghĩa file an toàn; chỉ trạng thái `READY` mới được tham chiếu.
4. Avatar được decode/re-encode thành WebP/JPEG đã strip metadata rồi promote sang
   public key bất biến. Không phục vụ trực tiếp byte do user upload.
5. Private file không có public URL. Signed GET là bearer token, TTL mặc định 60
   giây, chỉ phát sau khi policy kiểm tra lại tại thời điểm request.
6. Consent là append-only receipt theo document/version, không phải boolean.
7. Account deletion là state machine bất đồng bộ. Xóa/anonymize theo ownership và
   retention; audit/tombstone tối thiểu không chứa PII được giữ khi có lý do đã duyệt.
8. File scanning production là fail-closed. Fake inspector chỉ được phép ở
   local/test và hosted environment phải fail startup nếu fake được chọn.
9. Object key không phải authorization credential và không xuất hiện trong public
   API, log, metric label hoặc HTML analytics.
10. Không giữ Mongo transaction trong lúc gọi R2/MinIO; metadata transition dùng
    optimistic/conditional update và worker/outbox.

## 5. Domain model và ownership

### 5.1. Profile

Không tiếp tục nhồi mọi trường vào `UserAccount`. Tách aggregate/document theo
trách nhiệm để tránh identity login thay đổi cùng profile:

```text
UserProfile
  userId
  displayName
  normalizedDisplayName
  bio
  avatarFileId?
  avatarPublicUrl?
  createdAt / updatedAt
  version

UserPrivacySettings
  userId
  profileVisibility       MEMBERS | PRIVATE
  discoverableByName      boolean
  allowMessageRequests    boolean
  updatedAt
  version
```

Baseline policy:

- `MEMBERS` nghĩa là user đã xác thực được đọc projection cơ bản; không phải web
  công khai cho guest/search engine.
- `PRIVATE` chỉ owner và authority quản trị đúng scope đọc được. Không mở
  `FRIENDS` trước Stage 6 vì chưa có friendship policy đáng tin cậy.
- Default: `MEMBERS`, `discoverableByName=true`, `allowMessageRequests=true`; UI
  giải thích rõ tác động trước khi lưu.
- Search chỉ trả `userId`, display name, avatar URL đã duyệt và verification badge;
  dùng prefix normalized có giới hạn, cursor và rate limit. Không tìm bằng email,
  phone hoặc object key.
- `bio` là plain text, tối đa 300 Unicode code points; normalize line ending,
  không render HTML/Markdown, không tự động biến URL thành HTML không sanitize.
- `displayName` 2–80 code points, trim/collapse whitespace, giữ Unicode nhưng chặn
  control/bidi nguy hiểm theo policy đã test. Tên không unique.

Projection profile tương lai có chỗ mở rộng cho community/trip/review nhưng Stage 4
không trả field giả hoặc số liệu `0` gây hiểu nhầm.

### 5.2. Consent

```text
ConsentReceipt
  id
  userId
  consentType             TERMS | PRIVACY_NOTICE | AGE_18_ATTESTATION
  documentVersion
  decision                ACCEPTED | WITHDRAWN
  occurredAt
  source                   WEB
  locale
  correlationId
  supersedesReceiptId?
```

- Unique idempotency theo `userId + consentType + documentVersion + decision`.
- Backend lấy current document version từ typed config; client không tự chọn
  version được coi là current.
- Terms/Privacy bắt buộc được version hóa và hiển thị link nội dung tương ứng.
- Withdrawal chỉ áp dụng loại consent mà product/legal xác nhận có thể rút; không
  sửa receipt cũ.
- Không lưu full IP hoặc User-Agent trong receipt. Correlation ID dùng cho audit.
- Khi version bắt buộc thay đổi, session response trả `nextAction=REVIEW_CONSENT`;
  enforcement server-side, không chỉ redirect UI.

### 5.3. File asset

```text
FileAsset
  id
  ownerUserId
  purpose                 AVATAR | VERIFICATION_DOCUMENT
  visibility              PUBLIC | PRIVATE
  state                   PENDING_UPLOAD | UPLOADED | PROCESSING |
                          READY | REJECTED | DELETION_PENDING | DELETED
  stagingLocator          internal only
  finalLocator?           internal only
  declaredContentType
  detectedContentType?
  declaredSize
  actualSize?
  checksumSha256?
  etag?
  rejectionCode?
  uploadExpiresAt
  retentionUntil?
  createdAt / updatedAt / readyAt / deletedAt?
  version
```

- API chỉ dùng opaque `fileId`; bucket/key nằm trong infrastructure metadata.
- Key do server tạo bằng random 128-bit trở lên, có environment và purpose prefix;
  không chứa user email, phone, display name hoặc original filename.
- Một file thuộc đúng một owner và purpose không được đổi sau khi tạo.
- Avatar cuối dùng key versioned/immutable; thay avatar là tạo file mới và atomic
  swap profile pointer, không overwrite key cũ.
- Verification document không bao giờ chuyển sang public bucket.
- Original filename chỉ dùng để hiển thị nếu thật sự cần; sanitize, giới hạn và
  không dùng làm path. Baseline Stage 4 không lưu original filename.

### 5.4. Account deletion

```text
AccountDeletionRequest
  id
  userId
  state                   REQUESTED | PROCESSING | COMPLETED | FAILED
  requestedAt
  executeAfter
  completedAt?
  policyVersion
  attempts
  lastFailureCategory?
  version
```

Baseline kỹ thuật đề xuất thời gian chờ 7 ngày, nhưng chỉ khóa sau product/legal
review. Request yêu cầu Google re-auth không quá 5 phút, CSRF và idempotency key.

Khi request được chấp nhận:

1. Đặt account `DELETION_REQUESTED`, tăng authorization version.
2. Ghi deletion request và outbox trong cùng Mongo transaction.
3. Trả response thành công rồi revoke toàn bộ session.
4. Chặn login/use case thông thường; không tạo dữ liệu mới.
5. Worker đến hạn xóa identity-owned PII, object và projection; phát event versioned
   cho module khác, có retry và dead-letter/alert.
6. Hoàn tất bằng tombstone tối thiểu không chứa email/phone/name/object key. Không
   tái sử dụng event như bằng chứng để tự xóa audit có retention riêng.

Không hỗ trợ “undo” trong baseline cho tới khi flow re-auth/cancel và tác động pháp
lý được thiết kế rõ. UI phải cảnh báo đây là yêu cầu bất đồng bộ và không hứa dữ
liệu đã xóa khỏi backup ngay lập tức.

## 6. Upload và download protocol

### 6.1. Khởi tạo upload

`POST /api/v1/files/uploads`

Request: `purpose`, `contentType`, `sizeBytes`, `checksumSha256` (nếu client tính
được). Backend:

- Xác thực session, CSRF/origin, authority/purpose và account state.
- Rate limit theo user, session/device và IP tin cậy.
- Chặn quá số upload đang mở và quota byte/ngày.
- Allowlist baseline:
  - Avatar: JPEG, PNG, WebP; tối đa 5 MiB.
  - Verification: JPEG, PNG, PDF; tối đa 10 MiB mỗi file.
- Tạo `FileAsset(PENDING_UPLOAD)` và random staging key trong private bucket.
- Trả `fileId`, presigned PUT URL, required headers và `expiresAt`; TTL 5 phút.
- Ký `Content-Type` và checksum header khi khả dụng. Không tin chúng là kiểm tra
  nội dung cuối cùng.

Browser PUT trực tiếp tới R2/MinIO. Bucket CORS chỉ allow exact web origins, method
PUT/HEAD cần thiết và header đã ký; không dùng wildcard origin với credential.

### 6.2. Hoàn tất và kiểm tra

`POST /api/v1/files/{fileId}/complete`

- Idempotency key bắt buộc.
- Conditional transition `PENDING_UPLOAD → UPLOADED`; owner khác nhận 404 để giảm
  enumeration, không phải 403 tiết lộ file tồn tại.
- Adapter HEAD object và đối chiếu size, content type, checksum/etag khả dụng.
- Sai/mất object chuyển `REJECTED`, lên lịch delete; không promote.
- Hợp lệ metadata chuyển `PROCESSING` và phát outbox event.
- Worker tải với giới hạn byte/time, sniff magic bytes, parse/decode an toàn và gọi
  `FileContentInspector`.
- Avatar phải decode thành ảnh, kiểm tra dimension/pixel bomb, auto-orientation,
  strip EXIF/location và re-encode. File đầu ra mới được promote sang public bucket.
- Private document giữ private, nhưng chỉ `READY` sau inspection. Không public file
  nguyên bản hoặc file chưa scan.
- Transaction cập nhật `READY` và profile pointer/audit event theo use case; delete
  staging sau commit bằng job idempotent.

Presigned PUT có thể được dùng lại tới khi hết hạn. Vì vậy `complete` chỉ xử lý một
generation; upload lại staging key sau terminal state không được promote và sẽ bị
lifecycle/job xóa.

### 6.3. Đọc file

- Avatar `READY` trả URL public của key immutable, không trả signed URL. Cấu hình
  `Content-Type`, `Cache-Control: public, max-age=31536000, immutable` và
  `X-Content-Type-Options: nosniff` ở serving layer/domain.
- Private file: `POST /api/v1/files/{fileId}/download-url` kiểm tra owner hoặc admin
  scope phù hợp tại mỗi request rồi trả signed GET TTL 60 giây.
- Signed private response dùng content disposition an toàn; UI không nhúng tài liệu
  private vào trang/public analytics nếu không cần.
- Không cache signed URL trong shared cache, database hoặc browser storage dài hạn.
- Không ghi query string signed URL vào access log, error report hoặc telemetry.

### 6.4. Xóa và cleanup

- `DELETE /api/v1/files/{fileId}` chỉ owner/policy phù hợp, idempotent và chuyển
  `DELETION_PENDING`; worker xóa object rồi đánh dấu `DELETED`.
- Avatar đang active không bị xóa trước khi profile pointer được swap/clear.
- Upload `PENDING_UPLOAD/UPLOADED/REJECTED` quá 24 giờ được cleanup; lifecycle R2 là
  safety net, application job vẫn reconcile metadata.
- Avatar bị thay thế được giữ grace ngắn đã cấu hình để tránh race cache rồi xóa.
- Private document retention phụ thuộc trạng thái verification và legal policy;
  không hard-code một con số chưa review.
- Job liệt kê theo metadata/index của ứng dụng; không quét toàn bucket mỗi vòng.
- Reconciliation định kỳ phát hiện metadata thiếu object và orphan prefix có tuổi;
  report aggregate, không log key/PII.

## 7. API contract dự kiến

| Method    | Endpoint                              | Mục đích                                   |
| --------- | ------------------------------------- | ------------------------------------------ |
| GET       | `/api/v1/me/profile`                  | Hồ sơ đầy đủ của owner                     |
| PATCH     | `/api/v1/me/profile`                  | Sửa display name/bio bằng expected version |
| GET       | `/api/v1/users/{userId}`              | Projection theo viewer/privacy             |
| GET       | `/api/v1/users?query=&cursor=`        | Tìm tên có rate limit/policy               |
| GET/PATCH | `/api/v1/me/privacy`                  | Đọc/sửa privacy bằng expected version      |
| GET       | `/api/v1/me/consents`                 | Current requirements và receipt của owner  |
| POST      | `/api/v1/me/consents`                 | Ghi decision theo current version          |
| POST      | `/api/v1/me/deletion-requests`        | Yêu cầu xóa, fresh re-auth + idempotency   |
| GET       | `/api/v1/me/deletion-request`         | Trạng thái yêu cầu hiện tại                |
| POST      | `/api/v1/files/uploads`               | Tạo upload intent/presigned PUT            |
| POST      | `/api/v1/files/{fileId}/complete`     | Xác nhận upload và bắt đầu inspection      |
| GET       | `/api/v1/files/{fileId}`              | Metadata/status an toàn theo owner/policy  |
| POST      | `/api/v1/files/{fileId}/download-url` | Signed GET cho private file                |
| DELETE    | `/api/v1/files/{fileId}`              | Yêu cầu xóa file                           |

Quy tắc contract:

- DTO không trả email, phone, locator, checksum nội bộ, rejection detail nhạy cảm
  hoặc raw SDK response.
- Mutation dùng `expectedVersion` hoặc `If-Match`; stale write trả
  `PROFILE_VERSION_CONFLICT`/`PRIVACY_VERSION_CONFLICT`.
- Upload/complete/delete/deletion request có idempotency semantics rõ.
- Trạng thái processing có polling interval/backoff; không loop liên tục.
- Error code tối thiểu:
  `PROFILE_NOT_FOUND`, `PROFILE_NOT_VISIBLE`, `PROFILE_INVALID`,
  `PROFILE_VERSION_CONFLICT`, `CONSENT_REQUIRED`, `CONSENT_VERSION_INVALID`,
  `FILE_NOT_FOUND`, `FILE_PURPOSE_NOT_ALLOWED`, `FILE_TYPE_NOT_ALLOWED`,
  `FILE_TOO_LARGE`, `FILE_UPLOAD_EXPIRED`, `FILE_UPLOAD_INCOMPLETE`,
  `FILE_CONTENT_INVALID`, `FILE_PROCESSING`, `FILE_RATE_LIMITED`,
  `ACCOUNT_DELETION_REAUTH_REQUIRED`, `ACCOUNT_DELETION_ALREADY_REQUESTED`.
- OpenAPI là nguồn TypeScript types; CI full-diff generated client.

## 8. Web scope

Thêm feature theo App Router hiện tại, đọc hướng dẫn Next.js cục bộ trước khi code:

- `/me/profile`: form display name/bio, avatar preview, upload progress,
  processing/rejected state, replace/remove và optimistic concurrency recovery.
- `/users/[userId]`: profile projection; private/not-found dùng trạng thái không
  tiết lộ quá mức; không render dữ liệu chưa được backend trả.
- `/settings/privacy`: các setting hiện được backend enforcement, mô tả rõ ai có
  thể tìm/xem/nhắn.
- `/settings/consent`: version hiện tại, link tài liệu, receipt history tối thiểu.
- `/settings/account`: yêu cầu xóa, fresh Google re-auth và trạng thái pending.

UI bắt buộc:

- Upload dùng generated client để tạo/complete; PUT presigned là ngoại lệ transport
  được đóng gói trong một adapter riêng, không tự ghép object URL.
- Không đọc file toàn bộ vào base64/localStorage; preview URL được revoke.
- Client validation chỉ hỗ trợ UX; backend vẫn quyết định.
- Abort upload khi user hủy; retry tạo intent mới nếu URL hết hạn.
- Loading, empty, error, offline, retry, focus management, keyboard và screen-reader
  announcement cho upload/progress/error.
- Avatar có alt text phù hợp; crop không phải gate Stage 4.
- E2E chạy desktop/mobile và không phụ thuộc R2 thật; MinIO/Testcontainers là bằng
  chứng adapter, browser dùng test harness tương thích S3.

## 9. Security và privacy controls

- Owner/resource policy kiểm tra trên mọi read/write; không chỉ dựa vào role.
- CSRF/origin cho API tạo URL, complete, privacy, consent và deletion.
- Presigned URL được coi là secret bearer ngắn hạn; redaction filter phải che toàn
  bộ query signature trong log/error/trace.
- Rate limit upload intent, complete, search và download-url; quota byte/ngày và số
  outstanding upload chống lạm dụng chi phí.
- Bucket credential chỉ có quyền cần thiết; tách credential theo environment và
  ưu tiên tách read/write/public/private scope khi R2 policy cho phép.
- Private bucket chặn public access. Public bucket chỉ chứa derivative avatar đã
  inspect; không chứa staging hoặc verification document.
- Không tin extension, filename hoặc `Content-Type`; kết hợp allowlist, size, magic
  byte, safe parser/decode và malware/content inspector.
- Chặn SVG/HTML/scriptable content và polyglot không parse được trong baseline.
- Giới hạn dimension/pixel count, decompression ratio, parser timeout và memory.
- Không trả khác biệt owner-sensitive giúp dò file/user; test IDOR với fileId khác.
- Cache profile phải vary theo viewer/policy hoặc không cache ở Stage 4. Privacy
  update có hiệu lực ở lần đọc tiếp theo.
- Log/metric không chứa bio, display name, consent content, filename, object key,
  signed URL hoặc file bytes.
- Backup/restore và deletion retention phải được document; “đã xóa” không được báo
  trước khi workflow đạt terminal state theo policy.

## 10. Persistence, index và migration

Collection dự kiến:

- `user_profiles`: unique `userId`; search index normalized display name có điều
  kiện discoverable; versioned optimistic locking.
- `user_privacy_settings`: unique `userId`.
- `consent_receipts`: unique idempotency key; index `userId, consentType,
occurredAt desc`.
- `file_assets`: index `ownerUserId, purpose, state`; TTL không dùng để thay worker
  khi cần xóa object; index `state, uploadExpiresAt` cho cleanup.
- `account_deletion_requests`: unique active request/user; index `state,
executeAfter` cho worker claim.

Migration:

- Backfill profile từ `UserDocument.displayName/avatarUrl` nhưng không tự coi avatar
  Google là file do Dike sở hữu. Giữ external avatar snapshot riêng hoặc clear theo
  policy đã chốt; không tạo fake `FileAsset` trỏ URL ngoài.
- Tạo privacy default rõ ràng, idempotent; không vô tình mở user đã bị khóa/xóa.
- Không backfill consent. User chưa có receipt được yêu cầu review version hiện tại.
- Migration có checksum, lock và integration test rerun/rollback như foundation.
- Index search không chứa phone/email; test explain/index cho dataset pilot.

## 11. Work breakdown và dependency

| ID    | Công việc                                               | Phụ thuộc           | Bằng chứng hoàn thành                    |
| ----- | ------------------------------------------------------- | ------------------- | ---------------------------------------- |
| S4-00 | Preflight, baseline, issue/milestone và Docker gate     | Stage 3             | Root gates + MinIO không skip            |
| S4-01 | ADR 0013, data classification, legal/product decisions  | S4-00               | ADR review; retention matrix có owner    |
| S4-02 | Storage port: presign/head/copy/delete và typed config  | S4-01               | MinIO/R2-compatible contract tests       |
| S4-03 | Profile/privacy domain, migration và indexes            | S4-01               | Default/private/stale-write tests        |
| S4-04 | Profile/privacy API và policy projection                | S4-03               | Owner/viewer/anonymous/locked matrix     |
| S4-05 | Consent ledger và enforcement                           | S4-01, S4-03        | Version/idempotency/nextAction tests     |
| S4-06 | File metadata + upload intent/complete protocol         | S4-02, S4-03        | IDOR, expiry, overwrite/race tests       |
| S4-07 | Inspector, image transform và quarantine promotion      | S4-06               | Magic byte/pixel bomb/EXIF/malware tests |
| S4-08 | Private download authorization và public avatar serving | S4-07               | Private isolation + signed expiry tests  |
| S4-09 | Cleanup, reconciliation, retention và replacement       | S4-07, outbox       | Crash/retry/orphan tests                 |
| S4-10 | Account deletion state machine/orchestrator             | S4-01, S4-05, S4-09 | Session revoke + idempotent purge tests  |
| S4-11 | OpenAPI và generated TypeScript client                  | S4-04 đến S4-10     | Contract parity/full diff xanh           |
| S4-12 | Web profile/privacy/consent/account/upload UX           | S4-11               | Component/a11y/responsive tests          |
| S4-13 | E2E, security/failure injection và performance          | S4-12               | Ma trận mục 12 đạt, không skip           |
| S4-14 | README/env/runbook/observability và Stage 5 handoff     | S4-13               | Reviewer + CI + ops evidence             |

Thứ tự tích hợp: decisions → storage contract/profile schema → profile/privacy và
consent → upload quarantine → inspection/promotion → cleanup/deletion → contract →
web → acceptance. Giữ mỗi commit/PR nhỏ và `main` xanh.

Ước lượng ban đầu: 15–22 ngày công kỹ thuật và 4–6 ngày công review/test, chưa tính
thời gian chọn malware scanner, legal review hoặc cấp R2 staging. Đánh giá lại sau
S4-01 và S4-07. Nếu cần giảm scope, hoãn search/crop/polish; không cắt quarantine,
authorization, scanning, retention hay deletion correctness.

## 12. Ma trận kiểm thử

| Nhóm         | Test bắt buộc                                                                            |
| ------------ | ---------------------------------------------------------------------------------------- |
| Profile      | Validation Unicode, bio plain text, stale version, owner/viewer projection               |
| Privacy      | Default, PRIVATE, discoverability, cache invalidation, locked/deleting user              |
| Consent      | Current/old version, append-only, duplicate retry, withdrawal policy, enforcement        |
| Upload       | MIME spoof, magic mismatch, oversize, missing object, expired URL, wrong headers         |
| Image        | EXIF/GPS strip, huge dimension, decompression bomb, malformed/polyglot, re-encode        |
| Private file | Owner/admin scope, outsider IDOR, signed URL expiry, guessed key, public ACL denial      |
| Concurrency  | Double complete, replace avatar race, complete/delete, cleanup/processing, stale profile |
| Atomicity    | Metadata/outbox rollback, pointer swap, deletion request/outbox, retry after crash       |
| Cleanup      | Orphan staging, missing object, repeated delete, lifecycle delay, worker lease reclaim   |
| Deletion     | Fresh re-auth, session revoke, PII purge, tombstone, repeated event, partial failure     |
| Security     | CSRF/origin, rate/quota, log redaction, object key secrecy, parser resource limits       |
| Contract     | OpenAPI error/status/header, generated client full diff, no SDK/domain leakage           |
| UI/E2E       | Edit profile, upload/replace/remove avatar, privacy, consent, deletion warning           |
| Regression   | Google/OTP/session Stage 2–3, architecture boundaries, fresh clone and root checks       |

Integration test dùng Mongo replica set, Redis và MinIO thật qua Testcontainers.
Không đánh dấu stage hoàn tất nếu storage/Docker test skip. Test race dùng barrier/latch
để tạo cạnh tranh thật. Fixture file phải tổng hợp, nhỏ và không chứa giấy tờ/PII.

Performance baseline cho pilot phải đo, không đoán:

- Profile read/search trên dataset tối thiểu 1.000 user tổng hợp.
- Tạo presigned URL không gọi upload data qua API process.
- Worker có giới hạn concurrency/memory; một file độc hại không làm cạn worker.
- Theo dõi queue age, processing latency, reject rate và cleanup backlog.

## 13. Vận hành và failure handling

- R2/MinIO unavailable: không cấp upload/download URL mới; profile text vẫn hoạt
  động nếu không phụ thuộc storage. Không fallback lưu file vào container disk.
- Inspector unavailable: file ở `PROCESSING`, fail-closed, retry có backoff; không
  promote để “giải tắc”.
- Worker crash sau promote trước metadata commit: reconciliation nhận diện final
  generation và hoàn tất/xóa idempotent theo state.
- Worker crash sau pointer swap trước xóa avatar cũ: cleanup retry; avatar mới vẫn
  là nguồn đúng.
- Delete object trả not-found được coi idempotent success sau khi ownership/locator
  lấy từ metadata đáng tin cậy.
- Credential leak: revoke/rotate key, invalidate URL bằng expiry ngắn và cân nhắc
  đổi locator; không log URL để điều tra.
- Bucket policy/CORS drift: deployment smoke kiểm tra private denial, public avatar
  read, exact origin PUT và signed expiry.
- Cleanup backlog/processing age vượt threshold phát alert; metric dùng outcome,
  purpose và environment hữu hạn, không dùng user/file/key làm label.
- Runbook mô tả manual quarantine/delete/replay theo file ID nội bộ với audit; không
  hướng dẫn sửa trực tiếp Mongo/R2 thành happy path.

## 14. Definition of Done

Stage 4 chỉ Complete khi:

- ADR 0013 Accepted; retention/consent/deletion matrix có product, security/privacy
  và vận hành owner xác nhận.
- Profile/privacy/consent/file/deletion API và web đúng scope, OpenAPI/client không
  drift, UI desktop/mobile/accessibility đạt.
- Testcontainers chứng minh private isolation, signed expiry, validation, cleanup,
  concurrency và transaction; không có test bắt buộc bị skip.
- Một người ngoài biết object key/file ID vẫn không đọc được private file.
- File sai MIME/magic byte, quá dung lượng, chứa active content hoặc chưa inspect
  không thể thành `READY`/public.
- Hosted environment fail startup với fake inspector hoặc bucket/config không an
  toàn; production credentials không có trong repo/artifact.
- Account deletion thu hồi session, purge identity-owned PII/file và retry an toàn;
  UI/API không báo hoàn tất sớm.
- Log, trace, report và test artifact không chứa signed URL, object key, file bytes,
  consent content hoặc PII.
- `pnpm check`, Playwright và `mvnw verify` chạy trên đúng commit CI; root build và
  contract parity xanh.
- README, env sample, ADR index, module docs và runbook storage/deletion cập nhật.

## 15. Handoff Stage 5

Stage 5 nhận được:

- User profile và privacy projection ổn định.
- Private verification file ở trạng thái `READY`, có owner/purpose/checksum và
  authorization port; không có public URL.
- File lifecycle/retention/cleanup và audit event versioned.
- Consent/age attestation hiện hành và account state không pending deletion.
- Adapter eKYC Stage 5 chỉ nhận `fileId` đã authorized/ready, không nhận object key
  do browser gửi và không tự bỏ qua scanning.

Stage 4 không tự nâng verification status hoặc authority. eKYC callback/admin review
ở Stage 5 phải dùng transaction, idempotency và audit riêng.

## 16. Nguồn kỹ thuật

- [Master plan](PLAN_MASTER.md), [Stage 3](STAGE_3.md),
  [ADR 0007](../docs/architecture/adr/0007-cloudflare-r2-object-storage.md).
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/):
  supported operations, expiry, signed content type và bearer-token semantics.
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/): exact
  origins/methods/headers cho browser upload.
- [Cloudflare R2 object lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/):
  prefix lifecycle và cleanup delay.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html):
  allowlist, size, generated filename, content/signature validation và storage isolation.

Các nguồn trên không thay thế threat model, legal review hoặc test với adapter/config
thật của Dike.
