# Kế hoạch giao diện Dike Mobile

## Mục tiêu và phạm vi

Đồng bộ ngôn ngữ thiết kế với web hiện tại, chuyển bố cục sang tương tác cảm ứng.
Phạm vi gồm mọi route mobile hiện có và các luồng còn thiếu để hoàn thiện trải nghiệm
thành viên. Đây là kế hoạch triển khai; chưa coi các màn hình hiện tại là bản thiết kế
hoàn thiện hay mọi nút hiện có đã kết nối API.

Nguồn tham chiếu chính:

- `apps/web/app/styles.css`: nền mint, xanh emerald, card trắng, bóng mềm,
  accent vàng cho người đi ké, minh họa thông báo và xác minh.
- `apps/web/app/components/authenticated-home.tsx`: feed, bộ lọc, card hành trình.
- `apps/web/app/rides/new/unified-ride-flow.tsx`: biểu mẫu tạo hành trình.
- `apps/web/app/profile/page.tsx`, `apps/web/app/settings/page.tsx`,
  `apps/web/app/verification/page.tsx`: hồ sơ, cài đặt và trạng thái xác minh.
- `apps/web/app/inbox/conversation-content.tsx`: hội thoại.
- `packages/design-tokens/src/index.ts`: token dùng chung; web đang có màu và
  typography bổ sung, cần đối chiếu trước khi chốt token mobile.

## Hướng mỹ thuật

- Nền mint nhạt, vùng hero sáng; emerald cho CTA, chữ xanh đậm và nội dung phụ xám xanh.
- Giữ accent vàng của web cho nhu cầu đi ké, kèm nhãn chữ để phân biệt trạng thái.
- Plus Jakarta Sans như web, có đủ ký tự tiếng Việt; tải font trước khi hiện UI.
- Card trắng bo 20–26, viền xanh mờ, bóng nhẹ; padding màn hình 20–24,
  nhịp khoảng cách 4/8/12/16/24/32; chữ nội dung tối thiểu 14–16.
- Minh họa hành trình, xe, lá, bản đồ và thông báo lấy từ asset web đã được duyệt;
  kiểm tra kích thước và quyền sử dụng trước khi dùng chung. Không kéo nguyên layout desktop.
- Header gọn với logo Dike và thông báo; bottom tabs 4 mục. Hiệu ứng kính chỉ ở
  thanh điều hướng nếu đảm bảo tương phản và hiệu năng Android.
- Thay emoji/ký tự hiện tại bằng một bộ icon thống nhất; hỗ trợ cỡ chữ hệ thống,
  vùng chạm tối thiểu 48, safe area và bàn phím.

## Danh mục màn hình

| Màn hình / route                  | Thiết kế và tương tác cần hoàn thiện                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/sign-in`, `/auth/callback` | Splash, hero hành trình, CTA Google, đang xác thực, hủy, lỗi và thử lại; callback không hiển thị mã phiên                 |
| Onboarding điện thoại / OTP (mới) | Nhập số, xác nhận OTP, gửi lại có đếm ngược, lỗi và giới hạn; điều hướng theo `nextAction` từ backend                     |
| `/(tabs)`                         | Hero chào, tìm kiếm, chip tất cả/tôi chở/đi ké, lọc ngày, feed phân trang, card người đăng và tuyến đường, nút tạo chuyến |
| `/posts/[id]`                     | Card tuyến đường, người đăng, giờ/ghế/chi phí, yêu cầu tham gia, tiến trình phản hồi; bottom sheet xác nhận               |
| `/create-trip`                    | Chọn vai trò, điểm đi/đến có gợi ý, hoán đổi tuyến, phương tiện, ngày giờ, ghế/chi phí; xem lại và gửi thật               |
| `/(tabs)/trips`                   | Phân nhóm sắp đi/đang đi/đã xong; card trạng thái, vai trò và hành động đúng quyền                                        |
| `/trip/[id]`                      | Timeline chuyến, tuyến đường, thành viên, liên hệ, bắt đầu/kết thúc/hủy theo trạng thái; xác nhận trước thay đổi          |
| `/(tabs)/inbox`                   | Danh sách hội thoại, tìm kiếm, unread; đổi nhãn hiện tại “Bạn bè” thành “Tin nhắn” nếu màn hình vẫn chỉ chứa hội thoại    |
| `/chat/[id]`                      | Bubble chat, avatar, giờ gửi, composer bám bàn phím, gửi lại khi lỗi, cập nhật tin mới                                    |
| `/notifications`                  | Hero chuông như web, nhóm theo ngày, trạng thái chưa đọc, mở đúng đối tượng và đánh dấu đã đọc                            |
| `/(tabs)/profile`                 | Cover mint, avatar, thông tin, huy hiệu xác minh, thống kê có dữ liệu thật, liên kết cài đặt và đăng xuất                 |
| `/user/[id]`                      | Hồ sơ công khai, uy tín/đánh giá nếu API hỗ trợ, nhắn tin và báo cáo theo quyền                                           |
| `/schedules`                      | Lịch lặp dạng card/ngày, trạng thái hoạt động; tạo/sửa/xóa chỉ khi đã nối API                                             |
| `/settings`                       | Nhóm tài khoản, riêng tư, bảo mật, thông báo, tài liệu; mỗi hàng mở màn hình thật                                         |
| Cài đặt chi tiết (mới)            | Chỉnh hồ sơ, quyền riêng tư, consent, phiên thiết bị, tùy chọn thông báo; dùng pattern form/switch chung                  |
| `/verification`                   | Hero khiên như web, tiến trình xác minh, giấy tờ và CTA theo trạng thái; không hiển thị thành công giả                    |
| An toàn / báo cáo (mới)           | Bottom sheet lý do, nội dung bổ sung, xác nhận gửi; block/report theo API có sẵn                                          |

Mỗi màn hình dữ liệu phải có loading/skeleton, rỗng, lỗi/thử lại, offline và
refresh phù hợp. Form cần validation, trạng thái gửi, chống gửi lặp và phản hồi thành công.
Không bổ sung màn quản trị desktop vào app thành viên trong đợt này.

## Thứ tự triển khai và điều kiện hoàn thành

1. **Nền tảng**: chốt token, font, icon, button/input/chip/avatar/card,
   header/tab bar, bottom sheet và state component. Xong khi một gallery nhỏ
   thể hiện đầy đủ trạng thái, đọc tốt trên màn 360–430 và chữ lớn.
2. **Vào ứng dụng**: Google thật, callback, lưu/khôi phục/thu hồi phiên,
   onboarding điện thoại/OTP theo quyền. Xong khi chạy trọn luồng bằng development
   build trên Android và iOS; web login vẫn hoạt động.
3. **Khám phá và tạo chuyến**: feed, bài đăng, tìm kiếm/bộ lọc, biểu mẫu tạo chuyến.
   Xong khi nối API thật, kiểm tra validation, phân trang và các trường hợp rỗng/lỗi.
4. **Thực hiện chuyến**: danh sách/chỉ tiết chuyến, phản hồi, lịch lặp,
   xác nhận và thay đổi trạng thái. Xong khi hành động khớp quyền backend và dữ liệu cập nhật.
5. **Giao tiếp**: inbox, chat, thông báo, unread và mở deep link đúng màn.
   Xong khi gửi/nhận và reconnect không tạo tin trùng.
6. **Cá nhân và an toàn**: hồ sơ mình/người khác, cài đặt chi tiết,
   xác minh, consent, report/block. Xong khi không còn hàng cài đặt hoặc CTA giả.
7. **Kiểm tra đồng bộ**: đối chiếu ảnh mobile với từng màn web tham chiếu;
   kiểm tra Android/iOS, màn nhỏ, bàn phím, safe area, tương phản, tiếng Việt,
   mạng chậm/mất mạng và phiên hết hạn. Chạy lint/typecheck và kiểm tra luồng chính.

## Tình trạng đăng nhập Google vừa bổ sung

Nút Google mở trình duyệt hệ thống tới backend đang dùng Google OIDC của web.
Backend trả mã một lần sống 60 giây qua `dike://auth/callback`; mobile đổi mã bằng
verifier S256 rồi lưu phiên vào SecureStore. State bảo vệ việc nhận nhầm callback.
Backend nhận Bearer session cho mobile và vẫn dùng HttpOnly cookie cho web.
Mã callback không phải token Google, không đưa session token vào URL.

Để chạy thử thật:

1. Đặt `EXPO_PUBLIC_API_URL` trong `apps/mobile/.env` tới backend mà điện thoại
   truy cập được, ví dụ `https://api.example.com/api/v1`; không dùng localhost.
2. Backend cần MongoDB, Redis và Google OAuth client hợp lệ. URL callback Google
   vẫn là public base URL của backend/web với `/api/v1/auth/callback/google` như
   cấu hình hiện tại, và phải khớp Google Console.
3. Build/cài lại bản development có `expo-web-browser`, `expo-crypto` và scheme
   `dike`. Expo Go không chạy được callback scheme riêng này.
4. Từ gốc repo chạy `pnpm dev:mobile --tunnel`. Tunnel Metro không tự public API.
5. Thử đăng nhập, hủy, hết hạn, khởi động lại và đăng xuất trên thiết bị thật.

Đăng nhập thành công không tự bỏ qua yêu cầu onboarding/xác minh của backend.
Các màn phone/OTP và consent đã được nối API, điều hướng dựa trên `nextAction`.

## Triển khai và bằng chứng hiện tại

Các route trong danh mục đã có giao diện dùng chung Jakarta Sans, Ionicons,
mint/emerald, card và bottom sheet. Đã thêm `/booking/[id]`, `/onboarding/phone`,
`/schedules/edit`, các trang `/settings/*` và gallery chỉ dùng trong development.
Logo, hình xe và nền hành trình được dùng lại từ bộ asset của web.
Đã chạy thành công 16 kiểm thử Chromium/API và đối chiếu ảnh chụp 9 màn web:
home, profile, settings, verification, notifications, inbox, schedules, create-trip
và chat. Ảnh web tham chiếu nằm trong `.tmp/mobile-reference`; ảnh mobile trong
`apps/mobile/test-results`.

| Bước                   | Bằng chứng hiện có                                                                                                         | Phần cần xác nhận tiếp                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Nền tảng            | `components/ui.tsx`, `Screen`, `DetailPage`, gallery; ảnh chụp 360/390/430 px                                              | Cỡ chữ hệ thống và safe area native                                          |
| 2. Vào ứng dụng        | Google handoff S256/state, SecureStore; test OTP gửi lại đúng phiên bản, hết hạn phiên và route guard; 11 kiểm thử backend | Google thật, hủy trình duyệt và khôi phục trên development build Android/iOS |
| 3. Khám phá/tạo chuyến | Feed phân trang/lọc; picker địa điểm; tạo route/source/trip/post; test pickup và tiếp tục publish sau lỗi không tạo trùng  | API cấu hình thật và mạng trên điện thoại                                    |
| 4. Thực hiện chuyến    | Danh sách, tiến trình, booking action có xác nhận; lịch tạo/sửa/tạm dừng/kết thúc có `If-Match`                            | Luồng nhiều thành viên trên thiết bị                                         |
| 5. Giao tiếp           | Poll cập nhật hội thoại/tin mới, unread/read; gửi lại giữ `clientMessageId`; thông báo mở đúng đối tượng                   | Bàn phím native và reconnect qua mạng thực                                   |
| 6. Cá nhân/an toàn     | Hồ sơ, privacy, consent, sessions, quyền thông báo hệ thống; report/block nối API                                          | Quyền hệ thống trên Android/iOS                                              |
| 7. Kiểm tra            | Lint/typecheck, Chromium API kiểm thử và bundle Hermes Android/iOS; ảnh chụp trong `apps/mobile/test-results`              | So sánh và kiểm tra trực tiếp trên Android/iOS                               |

Kiểm thử Chromium dùng API kiểm thử để xác nhận giao diện, điều hướng và nội dung
request. Kết quả này không chứng minh Google OAuth hoặc toàn bộ luồng đã chạy với
backend thật trên điện thoại. Không coi plan hoàn thành toàn bộ trước khi kiểm tra
các mục native ở cột cuối.

Tình trạng môi trường đã xác nhận: backend hiện chỉ chạy local, người dùng chưa
cài development build; máy có Android `platform-tools`, chưa có emulator/platform
để build local, và `adb devices` chưa thấy thiết bị kết nối. Không chạy được iOS
simulator trên máy Windows này. Hướng dẫn build/kết nối qua USB và các lệnh kiểm
tra nằm trong `apps/mobile/README.md`.

eKYC và duyệt giấy tờ chưa có backend thực thi trong phạm vi hiện tại của web.
Mobile hiển thị bằng chứng xác minh thực do API trả về; không cung cấp CTA tải
giấy tờ giả. Cài đặt thông báo quản lý quyền hệ thống và trung tâm in-app; chưa
coi việc cấp quyền là bằng chứng đã tích hợp gửi push từ backend.
