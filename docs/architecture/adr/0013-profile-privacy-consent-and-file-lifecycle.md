# ADR 0013 — Profile, privacy, consent and file lifecycle

- Status: Accepted
- Date: 2026-10-06

## Context

Dike cần hồ sơ thành viên, receipt đồng ý, yêu cầu xóa tài khoản và file eKYC/avatar
trước khi triển khai community và driver verification. Object key, presigned URL và
provider SDK không được trở thành quyền truy cập hoặc contract nghiệp vụ.

## Decision

- Module `identity` sở hữu profile, privacy, consent, deletion request và file
  metadata. Module `shared` chỉ xuất named interface cho object storage và outbox.
- Profile và privacy là document riêng, cập nhật bằng expected version. Profile
  `PRIVATE` chỉ owner hoặc `ADMIN` được đọc; search chỉ dùng projection tối thiểu.
- Consent là receipt append-only theo loại, phiên bản, quyết định và thời điểm.
  Phiên bản hiện hành đến từ typed server configuration. Chưa cho rút consent cho
  tới khi product/legal chốt semantics riêng.
- Upload dùng presigned `PUT` vào random staging key trong private bucket. Client
  chỉ nhận `fileId`; locator không xuất hiện trong public API.
- `complete` chỉ xếp file vào inspection. File chỉ được dùng ở trạng thái `READY`.
  Avatar được decode/re-encode JPEG, loại metadata rồi ghi vào public bucket bằng
  immutable key. Verification document luôn ở private bucket.
- Signed GET private có TTL 60 giây và chỉ cấp sau owner authorization. URL được
  coi là bearer secret và không được lưu/log.
- Basic inspector chỉ dành local/test. Staging/production fail startup nếu vẫn
  dùng `basic`; môi trường hosted phải cung cấp scanner fail-closed đã review.
- File processing, delete và account purge dùng versioned outbox handler,
  conditional state transition và retry. Không giữ Mongo transaction khi gọi S3.
- Account deletion yêu cầu Google re-auth trong 5 phút, đặt account thành
  `DELETION_REQUESTED`, thu hồi session và lên lịch purge sau 7 ngày theo policy
  `account-deletion-v1`. Thời gian này phải được review lại trước pilot.
- Audit/tombstone deletion request không chứa email, phone, name hoặc object key.

## Alternatives

- Lưu avatar trực tiếp trong MongoDB: loại vì làm phình database và bỏ qua
  quarantine/scanning.
- Proxy toàn bộ upload qua API: loại vì tăng memory/bandwidth và coupling runtime.
- Dùng object key làm quyền truy cập: loại vì key có thể bị đoán/rò và không thay
  thế authorization.
- Boolean consent: loại vì không chứng minh được phiên bản hoặc lịch sử quyết định.
- Xóa đồng bộ trong HTTP request: loại vì storage/module failure làm timeout và khó
  retry an toàn.

## Consequences

- Có thêm state machine, worker, cleanup và reconciliation cần vận hành.
- Browser phải upload hai bước và polling trạng thái processing.
- Production chưa thể nhận file thật nếu scanner adapter chưa được cấu hình.
- Profile text vẫn hoạt động khi storage lỗi; upload/download URL fail-closed.

## Validation

- Modulith verification bảo vệ named interface.
- Unit test kiểm tra Unicode/bidi, image re-encode, active PDF và upload allowlist.
- Integration gate dùng Mongo replica set, Redis và MinIO để kiểm tra transaction,
  private isolation, signed expiry, retry, race và cleanup.
- E2E kiểm tra profile, privacy, consent, avatar và cảnh báo deletion trên desktop
  cùng mobile viewport.

## Revisit triggers

- Product/legal thay đổi consent, waiting period, retention hoặc quyền rút consent.
- Chọn scanner/eKYC provider production.
- Cần CDN/custom domain, image variants hoặc malware quarantine riêng.
- Stage 6 thêm visibility `FRIENDS`, hoặc Stage 5 thêm admin document access.
