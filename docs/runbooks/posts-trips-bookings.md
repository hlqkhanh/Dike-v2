# Bài đăng, chuyến và booking — trạng thái triển khai

Ngày cập nhật: 07/10/2026. Tiếp tục từ `836b684`, hợp nhất các thay đổi
Stage 7–8 trên `origin/main` qua `ec39062`. Đây là báo cáo phần đã triển khai;
**chưa phải biên bản nghiệm thu toàn bộ Stage 9–11**.

## Phần có thể sử dụng

- Bản đồ → chọn tuyến → nhập khoảng giờ → lưu bản nháp NEED_RIDE → xem lại → đăng.
  Snapshot tuyến thuộc người dùng, còn hạn và khớp hai điểm; địa chỉ chính xác
  không được đưa vào feed. `latestDeparture` tính từ deadline trừ thời lượng server.
- Bài đăng draft/open/close/expire, visibility, feed mới nhất/bạn bè/cộng đồng,
  bài của tôi, lưu/bỏ lưu, report intake có quota và idempotency.
- Trip domain/API tạo, sửa trước khi có booking, mở, bắt đầu, hủy và hoàn tất;
  chỗ xe máy tối đa một, xe ô tô theo capacity từ nguồn xe được duyệt.
- Proposal hai chiều, recipient accept một lần, reject/withdraw/expire. Acceptance
  nguyên tử: quyền, intent, availability, seat, booking, post và outbox cùng Mongo transaction.
- Booking arrival/boarding/start/complete/cancel/no-show/end-early; mã lên xe chỉ
  hành khách đọc, tài xế xác nhận, giới hạn thử mã và tiêu thụ một lần.
- Hủy trước departure trả chỗ đúng một lần. Chỉ offer đóng do AUTO_FULL được tự mở;
  bài chủ đã đóng không tự mở. Hoàn tất/kết thúc sớm không bán lại chỗ theo đoạn.
- `find-again` tạo draft mới sau cancel/no-show/end-early, cần nguồn còn hợp lệ và
  không có booking active. Người dùng phải tự kiểm tra và đăng lại.
- Trang `/feed`, `/feed/new`, `/trips`, `/proposals`, `/bookings` và trang chi tiết;
  API client có CSRF, cookie credentials, no-store và giữ key khi retry.

## Các gate còn mở

| Gate                                 | Tình trạng và tác động                                                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 5 vehicle approval/capacity    | Chưa có adapter xe được duyệt. `RideResources` mặc định từ chối tạo/mở chuyến; simulated driver approval không thay thế vehicle approval.                 |
| Stage 5 community membership         | Mặc định không cấp membership. Cần writer/acceptance dùng chung transaction fence trước khi mở COMMUNITY.                                                 |
| Quote ghép chuyến nhiều điểm         | Stage 8 có route/estimate, chưa có authoritative proposal quote với detour, stop commitments và version. Không chuyển estimate đơn tuyến thành quote giả. |
| Matching feed và lịch FRIENDS 7 ngày | Chưa triển khai ranking/route matching và projection lịch trong feed; không hiển thị nhãn phù hợp nếu chưa kiểm chứng.                                    |
| Form tạo/sửa trip và gửi proposal    | API/domain đã có, lựa chọn xe và quote trên UI còn chờ hai nguồn nói trên. UI hiện quản lý các bản ghi đã có.                                             |
| Mongo race/rollback integration      | Có Testcontainers tests; cần Docker replica set để chạy. Trên máy hiện tại Docker engine không hoạt động nên các IT bị skip.                              |
| Performance nghiệm thu               | Chưa có evidence p95 < 2 giây với 1.000 candidate và explain-plan đại diện.                                                                               |

Không bật production booking bằng adapter mock hoặc nhận capacity/quote/giá trần
từ JSON do client tự khai. Endpoint `/api/v1/ride-capabilities` phản ánh adapter
sẵn sàng và khóa boarding; capability không thay thế authorization mỗi lệnh.

## Dữ liệu và giao dịch

Migration `V009_0`, `V009_1`, `V009_2`, `V010_1` tạo receipts/guards, bài đăng,
reports, trip/proposal/booking/interval/secret và các unique/partial index.
Receipt giữ 30 ngày; unique `booking.proposalId` vẫn chống accept lại sau TTL.
Không TTL xóa lịch sử bài, proposal hay booking.

Khóa availability theo user ngăn write skew giữa hai trip khác nhau. Interval
là nửa mở, cộng 15 phút cuối. Completion/early end giữ khoảng đã cam kết;
cancel/no-show trước boarding giải phóng interval hành khách. Trip cancel
giải phóng lịch tài xế, completion giữ buffer đã cam kết.

Public identity guard ghi cùng document account mà suspension/deletion sử dụng.
Social writer và acceptance ghi cùng pair guard; community/vehicle adapter phải
thực hiện fence tương ứng. Các check authorization chạy lại trong transaction.
Stage 7 `replaceIntent` so sánh cả version và commitment state để request đọc
PRIVATE cũ không ghi đè PUBLISHED/BOOKED. Endpoint match cũ trả 410, không được
chuyển thẳng intent thành booking pending ngoài proposal flow.

Outbox handlers lưu revision tăng đơn điệu, replay không lùi version. Đây là
projection nội bộ; không có nghĩa push notification đã gửi. Worker profile
`worker` hoặc `combined` chạy expiry. Trip còn booking active không tự expire
chỉ vì quá giờ xuất phát; cần xử lý vận hành các chuyến trễ.

## Mã lên xe

Đặt `DIKE_RIDE_BOARDING_KEY` bằng 32 byte ngẫu nhiên được encode Base64 trong
secret manager hoặc env local không commit. Mã gồm sáu số CSPRNG, lưu AES-256-GCM
với nonce riêng và booking ID làm AAD; so sánh constant-time trong bộ nhớ.
Năm lần thử mỗi booking trong 15 phút, bộ đếm commit cả khi mã sai. Chỉ participant
đúng vai trò được thử/đọc. Sau boarding xóa ciphertext; mã không vào event/log/receipt.

Hiện có một encryption key. Giữ cùng key trên mọi instance và qua restart;
không đổi key khi còn booking chưa boarding nếu chưa có quy trình re-encrypt.
Key rotation nhiều phiên bản và rate limit theo IP vẫn là công việc hardening.

## Kiểm tra

Chạy Node 24.21.0, Java 21; Git local `dike.nodePath` phải trỏ đúng toolchain.

```powershell
corepack pnpm check
.\mvnw.cmd -B -ntp -f apps/backend/pom.xml verify
corepack pnpm --filter @dike/web e2e --workers=1
```

`RideAcceptanceIT` kiểm race chỗ cuối, cùng intent, accept retry, lịch chồng,
rollback khi outbox lỗi và boarding secret. `PlanningJourneySourcesIT` kiểm
ownership route, deadline, snapshot công khai và stale intent write.
Playwright dùng API mock để kiểm UI; không thay thế Mongo transaction tests
hay nghiệm thu routing provider thật.
