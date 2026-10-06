# File storage and account deletion runbook

## Phạm vi

Runbook này áp dụng cho file Stage 4 và account deletion thuộc module `identity`.
Không dùng sửa trực tiếp MongoDB/R2 làm happy path.

## Cấu hình bắt buộc

- Public và private bucket phải tách biệt; private bucket chặn anonymous access.
- `DIKE_PUBLIC_OBJECT_BASE_URL` phải là HTTPS ngoài local.
- `DIKE_FILE_INSPECTOR=basic` chỉ được dùng local/test. Hosted environment phải có
  adapter scanner đã review; application chủ động fail startup nếu còn `basic`.
- Credential chỉ có quyền theo bucket/environment và được rotate qua secret manager.
- CORS browser chỉ cho exact web origin, `PUT` và signed headers; không wildcard.

## Điều tra file kẹt

1. Tra cứu bằng internal `fileId`; không dán object key hoặc signed URL vào issue.
2. Kiểm tra state, outbox event type/version, attempts và queue age.
3. Nếu inspector/storage tạm lỗi, sửa dependency rồi để retry/backoff xử lý.
4. Không chuyển thủ công `PROCESSING` sang `READY`.
5. Nếu byte không an toàn, chuyển qua flow reject/delete có audit; không tải file
   về máy cá nhân.

## Cleanup và reconciliation

- Job xử lý metadata staging quá 24 giờ theo batch, delete idempotent và đánh dấu
  terminal state.
- Lifecycle bucket là safety net, không thay application reconciliation.
- Alert theo processing age, reject rate và cleanup backlog; metric không dùng
  user ID, file ID hoặc locator làm label.

## Account deletion

- API chỉ nhận yêu cầu sau Google re-auth tối đa 5 phút và thu hồi mọi session.
- Outbox event chỉ khả dụng tại `executeAfter`; handler xóa identity-owned object và
  PII rồi mới đánh dấu request `COMPLETED`.
- Khi storage lỗi, event phải retry; UI không được báo hoàn tất sớm.
- Backup/PITR tuân theo retention riêng. Không hứa xóa ngay khỏi backup.

## Credential hoặc signed URL bị lộ

1. Revoke/rotate credential bị ảnh hưởng.
2. Kiểm tra log/traces/artifact và xóa quyền truy cập vào artifact nhạy cảm.
3. Signed URL hết hạn ngắn; nếu cần, đổi final locator qua workflow có audit.
4. Ghi incident không chứa URL query, object key, email, phone hoặc file bytes.
