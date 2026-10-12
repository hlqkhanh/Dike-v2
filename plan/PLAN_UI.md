# Redesign toàn bộ luồng DIKÉ SHARE

## 1. Trải nghiệm và điều hướng mới

- `/` trở thành route thông minh:
  - Chưa đăng nhập: hiển thị landing page hiện tại.
  - Đã đăng nhập: hiển thị trang chủ ứng dụng mới.
  - Trong lúc kiểm tra session: dùng branded skeleton để tránh nháy giữa landing và app.
- Loại bỏ sidebar và mobile navigation hiện tại.
- Header sau đăng nhập chỉ gồm:
  - `Trang chủ` → `/`
  - `Bạn bè` → `/friends`
  - `Profile` → `/profile`
  - Nút chuông thông báo ở góc phải, có badge chưa đọc.
- Thông báo mở bằng popover trên desktop và full-screen sheet trên mobile; hỗ trợ đánh dấu đã đọc, đọc tất cả và đi tới nội dung liên quan.
- Auth, onboarding, offline và admin vẫn là các luồng hệ thống, không xuất hiện trong header chính.

## 2. Trang chủ sau đăng nhập

- Hero theo phong cách ảnh mẫu: hình nền xanh, lời chào theo tên người dùng, thanh tìm kiếm lớn và hai CTA:
  - `Tôi chở`: tài xế đăng chuyến có chỗ trống.
  - `Tôi đi ké`: hành khách tìm người chở.
- Ô tìm kiếm lọc feed ngay trên home:
  - Tìm theo điểm đi, điểm đến, nội dung ghi chú hoặc tên khu vực.
  - Tìm đồng thời bài `OFFER_RIDE` và `NEED_RIDE`.
  - Bộ lọc gọn: `Tất cả`, `Có chỗ trống`, `Cần người chở`.
  - Sắp xếp: mặc định mới nhất; cho phép chọn sắp khởi hành.
  - Query và bộ lọc được lưu trên URL để refresh/back vẫn giữ kết quả.
- Feed mặc định chỉ hiển thị bài đang mở và còn hiệu lực; card gồm người đăng, loại nhu cầu, tuyến đường, giờ đi, phương tiện, số ghế/chi phí và CTA phù hợp.
- Có đầy đủ loading skeleton, empty state, retry, phân trang cursor và trạng thái không có kết quả.

## 3. Luồng `Tôi chở / Tôi đi ké`

- Cả hai CTA dùng chung `/rides/new?mode=driver|passenger`, cho phép đổi chế độ ngay trên trang.
- Trường chung:
  - Điểm đi và điểm đến với autocomplete.
  - Phương tiện.
  - Ngày giờ khởi hành, mặc định giờ hiện tại theo múi giờ trình duyệt và gửi backend dưới dạng UTC.
  - Phạm vi hiển thị và ghi chú đặt trong phần “Tùy chọn thêm”.
- Chế độ `Tôi chở` bổ sung xe đã xác minh, số ghế và mức đóng góp.
- Chế độ `Tôi đi ké` tự tính thời gian đến dự kiến từ tuyến đường; người dùng có thể chỉnh deadline trong phần nâng cao.
- Khi hoàn tất form:
  1. Tạo route snapshot riêng tư.
  2. Tìm các bài đối ứng theo quyền xem, loại phương tiện, thời gian và độ tương thích tuyến.
  3. Hiển thị danh sách available ngay trên cùng trang.
  4. Mỗi kết quả có `Gửi đề nghị ngay`.
  5. Luôn có nút `Đăng chuyến` hoặc `Đăng nhu cầu` nếu người dùng chưa chọn kết quả.
- `Gửi đề nghị ngay` là một command idempotent: backend tạo và mở listing của người dùng nếu cần, tạo quote và gửi proposal tới kết quả đã chọn.
- Nếu kết quả hết chỗ/hết hạn, giữ nguyên dữ liệu form, thông báo rõ và tự refresh danh sách.
- Tài khoản chưa đủ quyền tài xế vẫn được dùng `Tôi đi ké`; chọn `Tôi chở` sẽ hiển thị yêu cầu xác minh cùng liên kết xử lý.

## 4. Gom các trang còn lại

| Điểm vào mới            | Nội dung                                                       |
| ----------------------- | -------------------------------------------------------------- |
| `/`                     | Home, tìm kiếm, feed, chuông thông báo                         |
| `/friends`              | Bạn bè, lời mời, tìm thành viên, chặn                          |
| `/profile?tab=overview` | Hồ sơ, xác minh, trạng thái tài khoản                          |
| `/profile?tab=rides`    | Chuyến đã đăng, đề nghị, booking, lịch trình và lịch sử        |
| `/profile?tab=messages` | Danh sách hội thoại và khung chat                              |
| `/profile?tab=settings` | Sửa hồ sơ, riêng tư, consent, thiết bị, tài khoản và đăng xuất |
| `/rides/new?mode=...`   | Form chung cho tài xế và hành khách                            |

- Các màn hình chi tiết booking/chuyến/proposal vẫn tồn tại vì chứa thao tác nghiệp vụ quan trọng, nhưng chỉ được mở từ card, notification hoặc Profile; không xuất hiện trong navigation.
- Public profile `/users/[userId]` tiếp tục được mở từ feed và Bạn bè.
- `Sẵn sàng đi ngay` được chuyển thành hành động trên chuyến sắp khởi hành của tài xế.
- Admin chỉ xuất hiện trong Profile khi session có quyền admin.
- URL cũ redirect tương thích:
  - `/feed` → `/`
  - `/map` → `/rides/new`
  - `/feed/new` → `/rides/new?mode=passenger`
  - `/trips/new` → `/rides/new?mode=driver`
  - `/trips`, `/bookings`, `/proposals`, `/schedules` → `/profile?tab=rides`
  - `/inbox` → `/profile?tab=messages`
  - `/notifications` → `/?panel=notifications`
  - `/me/profile`, `/settings`, `/verification`, `/account/sessions` → tab/section tương ứng trong Profile.

## 5. API và kiểu dữ liệu

- Mở rộng feed API với `q`, `type`, `sort`, `from`, `until` để tìm kiếm server-side trên toàn bộ dữ liệu thay vì chỉ lọc các trang đã tải.
- Thêm `POST /ride-matches/search` nhận `mode`, `routeId`, thời gian và phương tiện; trả về `RideMatchPage` với match token hết hạn, listing đối ứng, độ phù hợp và quote preview.
- Thêm command idempotent `POST /ride-match-proposals` để tạo listing cần thiết, publish/open, tạo quote và gửi proposal trong một giao dịch nghiệp vụ.
- Thêm command `POST /ride-listings` để frontend có thể tạo và đăng listing trong một lần bấm khi không chọn match.
- Kết quả match chỉ gồm bài OPEN, còn hiệu lực, đúng quyền riêng tư và vai trò đối ứng; ưu tiên tuyến gần nhau, thời gian gần nhau rồi mới tới độ mới.
- Giữ các API hiện tại trong giai đoạn chuyển đổi để URL cũ và các client khác không bị hỏng; cập nhật OpenAPI và regenerate TypeScript client.

## 6. Thứ tự triển khai

1. Tạo session-aware root, app header mới và authenticated home.
2. Chuyển feed/search lên `/`, bổ sung API tìm kiếm và notification modal.
3. Xây unified form, matching preview, đăng listing và gửi đề nghị trực tiếp.
4. Gom Trips, Messages và Settings vào Profile hub.
5. Thêm redirects, cập nhật deep link, xóa sidebar/RideNav và UI list page trùng lặp.
6. Chạy migration test, theo dõi lỗi API mới rồi mới loại bỏ component legacy.

## 7. Kiểm thử và tiêu chí nghiệm thu

- `/` hiển thị đúng landing hoặc authenticated home theo session, không lộ nội dung app khi chưa đăng nhập.
- Header chỉ có ba mục chính và chuông thông báo trên desktop/mobile.
- Search trả cả hai loại bài, giữ query trên URL, hỗ trợ empty/error/pagination.
- Hai chế độ form dùng chung route; thời gian mặc định hiện tại và chuyển UTC chính xác.
- Kết quả available xuất hiện trước khi đăng; gửi đề nghị chỉ tạo một proposal khi double-click/retry.
- Nút đăng fallback tạo listing OPEN và card mới xuất hiện trên home.
- Kiểm thử stale match, hết chỗ, quyền tài xế, route API lỗi và session hết hạn.
- Profile hub bao phủ trips, proposals, bookings, schedules, messages và settings.
- Tất cả URL cũ redirect đúng và giữ deep link chi tiết.
- E2E cho hai hành trình chính: `Tôi đi ké → match → gửi đề nghị` và `Tôi chở → không có match → đăng chuyến`.
- Kiểm tra keyboard navigation, focus trap cho notification modal, contrast, screen reader labels và responsive từ 360px trở lên.

## Giả định đã chốt

- CTA chính dùng đúng nhãn `Tôi chở` và `Tôi đi ké`.
- Feed và kết quả tìm kiếm nằm ngay trên home, không tạo trang search riêng.
- Tin nhắn, chuyến và cài đặt nằm trong Profile; thông báo dùng nút riêng trên header.
- Gửi đề nghị có thể tự tạo listing của người dùng để giữ trải nghiệm một lần bấm.
- Chưa thay đổi mô hình `NEED_RIDE`, `OFFER_RIDE`, proposal và booking hiện tại; lớp API mới chỉ hợp nhất các thao tác đang rời rạc.
