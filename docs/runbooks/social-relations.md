# Vận hành bạn bè và chặn — Stage 6

## Triển khai

Chạy migration `V006__social_relations` trên Mongo replica set trước mở traffic.
Không sửa checksum migration đã áp dụng. Unique low/high phải tạo thành công;
nếu gặp duplicate, dừng rollout và điều tra nguồn ghi, không xóa tự động.

UI ở `/friends`, action trên `/users/{userId}` và danh sách Đã chặn cùng màn.
REST ở `/api/v1/friendships`, `/api/v1/blocks`, `/api/v1/social/revision`.
Mutation yêu cầu session, Origin/CSRF và Idempotency-Key dài 8–100 ký tự.
Retry cùng thao tác dùng lại key; thao tác mới dùng key mới.

## Smoke với tài khoản tổng hợp

1. A và B đăng nhập ở hai browser context. A tìm B và gửi lời mời.
2. B gửi ngược chiều: vẫn incoming, chưa thành bạn. B chấp nhận riêng.
3. A hủy bạn: B mất quyền FRIENDS ngay ở lần đọc server kế tiếp, không đợi TTL.
4. Gửi lại bị cooldown 7 ngày; rút lời mời mới không thêm cooldown.
5. A chặn B: direct profile/search hai phía không trả thông tin. UI đang mở
   gỡ profile trong chu kỳ polling tiếp theo; tab cùng browser nhận broadcast.
6. B cũng chặn A, A bỏ chặn: quan hệ vẫn không được mở. B bỏ chặn không tự kết bạn.
7. C gọi accept với request ID của A/B: không được phép và không đổi dữ liệu.
8. Gửi lặp cùng key không thêm audit/outbox; cùng key khác payload trả 409.

Các test web dùng intercepted API là UI contract E2E, không thay smoke backend
thật. Test Mongo concurrency dùng Testcontainers replica set. Khi Docker vắng,
test bị skip theo convention repo và phải ghi nhận chưa nghiệm thu integration.

## Sự cố và rollback

- 429 gửi mới: kiểm quota user và số pending; không xóa quota tùy tiện. Block,
  hủy bạn và rút lời mời không bị quota gửi khóa.
- 409: client tải lại rồi xác nhận trạng thái; retry transaction có giới hạn.
- Profile còn hiển thị: kiểm revision endpoint, cache header và polling/focus;
  kiểm trực tiếp API phải deny trước khi xử lý UI. Không log nội dung profile.
- Worker backlog: kiểm outbox `social.relationship.changed`, event schema v1,
  retry/failed metrics sẵn có. Replay dùng relationVersion; không sửa relation
  từ event cũ. Không có cache allow để phải đợi worker thu hồi quyền.
- Mongo unavailable: fail closed, trả lỗi; không dựng response từ cache cũ.
- Rollback chỉ tới binary vẫn thực thi block. Nếu không có bản tương thích,
  ngừng social mutation mới và sửa tiến; không xóa collection hoặc migration.
- Audit collection chỉ cho vận hành được cấp quyền; không có public audit API.
  Actor/action/relation/version/time là dữ liệu hạn chế, không xuất vào metric labels.

## Gate còn lại

Stage 5 membership, Stage 7 lịch, Stage 9 feed, Stage 11 booking, Stage 12
socket/chat và Stage 14 review phải tích hợp policy qua public interface.
Không nhận cờ membership/ignoreBlock từ client. Booking đang hoạt động giữ
liên hệ phục vụ chuyến; review hợp lệ không mất quyền do block. Chưa có những
tài nguyên đó nên không được coi policy unit tests là feature đã triển khai.

## Kết quả kiểm tra local ngày 07/10/2026

- Node 24.21.0, Java 21; `pnpm check` chạy lint, typecheck, unit test, production
  build và generated-client check.
- Playwright `pnpm --filter @dike/web e2e --workers=1`: 14/14 đạt trên desktop
  và mobile Chromium. Bao gồm lời mời, hủy bạn, bỏ chặn và remote revision gỡ
  profile. API trong các browser test được intercept; không phải live API smoke.
- Backend unit/API/module tests: 62 đạt. Maven `verify` dùng convention
  `disabledWithoutDocker`; Docker Desktop service không truy cập được ở máy này,
  nên replica-set/OIDC/storage integration tests bị skip, chưa có bằng chứng đạt.
- Đã sửa lỗi invalidation chỉ mount ở trang chủ bằng monitor ở root provider;
  mọi route profile hiện nhận revision. Đổi privacy cũng tăng revision chung.
- Staging smoke, Mongo concurrency thực và STOMP vẫn cần môi trường/phần mềm
  tương ứng; không đánh dấu toàn bộ Stage 6 production-ready từ các kết quả trên.
