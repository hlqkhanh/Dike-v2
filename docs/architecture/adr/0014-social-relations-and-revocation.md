# ADR 0014 — Quan hệ xã hội và thu hồi quyền

- Status: Accepted
- Date: 2026-10-07
- Scope: Stage 6 core, baseline `f8b453f`

## Context

Master yêu cầu một quan hệ cho mỗi cặp user, cooldown 7 ngày và block thắng
friendship. Stage 4 đã có profile/search; membership Stage 5, lịch, feed, booking
và socket chưa có implementation tại baseline này.

## Decision

- `community` sở hữu aggregate `SocialRelation`: pair ID canonical có length
  prefix, unique low/high, friendship state, request ID cho từng vòng mời và
  tập tối đa hai người chặn. Mọi update dùng version trong Mongo transaction.
- Cooldown 168 giờ UTC áp dụng cả hai chiều sau từ chối hoặc hủy bạn. Rút lời
  mời không thêm cooldown. Block bạn bè thành REMOVED với cooldown; block lời
  mời thành CANCELLED. Bỏ chặn không khôi phục quan hệ và không xóa block bên kia.
- Account ACTIVE được kết bạn; không đòi VERIFIED_MEMBER. Identity thực thi
  account status; `SocialAccounts` là port do community định nghĩa, identity
  triển khai để không tạo dependency cycle. Resource owner gọi public
  `SocialAccessPolicy` và phải kiểm tra dữ kiện tài nguyên của mình.
- Block che profile/search hai phía, kể cả social-profile view của admin.
  Moderation/booking/review phải dùng use case riêng, chưa có generic bypass.
- Transaction ghi quan hệ, revision hai user, audit, receipt idempotency và
  outbox. Receipt giữ 8 ngày, replay trả projection hiện tại sau kiểm quyền;
  không lưu response riêng tư cũ. Request ID cũ không sửa vòng mời mới.
- Đợt này dùng quota Mongo cùng transaction: 10 lời mời/giờ UTC, 30/ngày UTC,
  tối đa 100 pending outgoing. Ghi quota actor trước count để serialize các
  target đồng thời. Đây là fixed window, không phải rolling window. Không dùng
  Redis cho quota gửi để tránh đặt reservation phân tán giữa Redis và Mongo.
  Search tiếp tục limiter account/IP Stage 4. Block/unfriend/cancel không dùng
  quota gửi. Hạn mức là cấu hình trong code được review, chưa có admin tuning.
- Không cache quyết định allow; mỗi read kiểm tra Mongo primary. API gửi
  `Cache-Control: no-store`. Client reset dữ liệu được bảo vệ sau mutation và
  BroadcastChannel giữa tab; revision polling 5 giây khi tab hoạt động giúp phía
  còn lại phát hiện thay đổi. Focus/reconnect tải lại dữ liệu.
- Privacy change tăng revision chung trong cùng transaction, để người xem chưa
  kết bạn cũng gỡ profile đã mất quyền. Pilot chấp nhận refetch rộng khi privacy
  đổi; trước scale cần thay bằng delivery có audience nhưng vẫn giữ server check.
- Polling không thay thế socket. Stage 12 vẫn phải kiểm SUBSCRIBE/reconnect và
  delivery cho room đang mở; Stage 6 không tuyên bố gate này đã đạt.
- Pagination dùng canonical pair ID tăng dần, không dùng updatedAt dễ dịch
  chuyển sau mutation. Client khử trùng khi gộp trang. Cursor dựa trên trang raw,
  nên trang sau vẫn tồn tại khi một số item bị loại bởi account status.
- Khi identity thực thi xóa tài khoản sau retention, gọi community purge trong
  transaction trước xóa dữ liệu identity. Purge quan hệ/receipt/audit/outbox xã
  hội, quota và revision của người xóa; tăng revision người còn lại. Không tự
  chạy TTL trên block hay cooldown đang hiệu lực.

## Consequences

Mongo primary/outbox transaction là điều kiện vận hành bắt buộc. Hỏng Mongo
không được phục vụ profile từ cache cũ. Outbox worker trễ không làm chậm server
revocation vì revision được ghi đồng bộ. Worker chỉ ghi deliveredVersion đơn
điệu lên quan hệ còn tồn tại; stage messaging sẽ bổ sung delivery thật.

Tài khoản trong danh sách chặn được biểu diễn bằng ID và nhãn chung, không lấy
profile bị chặn. API mới có error code ổn định nhưng không thông báo ai chặn.
Deployment này chưa đủ để nghiệm thu toàn bộ Stage 6 theo master: cần Stage 5
membership integration, tài nguyên các stage sau, socket và staging evidence.
