# Dike Mobile

Ứng dụng Expo SDK 57, dùng chung API và ngôn ngữ thiết kế với Dike Web.
Chạy các lệnh bên dưới từ thư mục gốc repository, trừ khi có ghi khác.

## Đăng nhập và API thật

Ứng dụng chỉ mở các trang thành viên sau khi backend xác thực phiên đăng nhập.
Không có chế độ bypass, dữ liệu demo hay ô nhập token. Đăng nhập Google dùng
scheme `dike://auth/callback` nên cần development build của Dike, không dùng Expo Go.

Tạo bản cài Android bằng tài khoản Expo của bạn:

```powershell
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

Liên kết hoặc tạo Expo project khi CLI yêu cầu. Với ứng dụng mới, cho phép tạo
Android keystore. Sau khi build thành công, mở đường dẫn build trên điện thoại,
tải và cài APK Dike. Quay về thư mục gốc repository trước các lệnh tiếp theo.

Backend local cần Docker Desktop đang chạy. Cấu hình Google OAuth loại **Web
application** cho backend (cùng client đang dùng ở web). `pnpm dev` đọc
`DIKE_GOOGLE_CLIENT_ID` và `DIKE_GOOGLE_CLIENT_SECRET` trong `.env.local` ở gốc repo,
hoặc file `%LOCALAPPDATA%/Dike/secrets/google-oauth-local.json` nếu đã có.
Không đưa client secret vào mobile. Khi Google OAuth đang ở chế độ Testing,
thêm email đăng nhập vào danh sách test users nếu cấu hình ứng dụng yêu cầu.

## Backend local và điện thoại Android qua USB

Cách này dùng được khi Wi-Fi trường không cho thiết bị kết nối trực tiếp với nhau.
Cần development build đã cài, USB debugging đã bật và điện thoại đã cho phép máy tính.

1. Chạy backend và web bằng quy trình local hiện có của repository (`pnpm dev`).
   Google OAuth client và callback `http://localhost:3000/api/v1/auth/callback/google`
   phải được cấu hình đúng như luồng web.
2. Kết nối điện thoại bằng USB. Nếu ADB chưa nằm trong PATH:

   ```powershell
   $adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adbPath devices
   & $adbPath reverse tcp:8081 tcp:8081
   & $adbPath reverse tcp:8080 tcp:8080
   & $adbPath reverse tcp:3000 tcp:3000
   ```

3. Tạo `apps/mobile/.env.local` với nội dung:

   ```dotenv
   EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1
   EXPO_PUBLIC_ANDROID_USB_LOCALHOST=true
   ```

4. Khởi động lại Metro và mở bằng bản dev của Dike:

   ```powershell
   pnpm dev:mobile --localhost
   ```

Ba reverse port phục vụ bundle Metro (8081), API native (8080) và callback Google
qua web (3000). Sau khi kết nối lại USB hoặc khởi động lại ADB, chạy lại các lệnh
`adb reverse`. Nếu app báo `unexpected end of stream` khi tải `127.0.0.1:8081`,
kiểm tra `adb reverse --list` có `tcp:8081 tcp:8081` và Metro vẫn đang chạy. Cấu hình
localhost này chỉ được chấp nhận trong development build, không bật cho production.
ADB phải hiển thị trạng thái `device`; `unauthorized` nghĩa là cần xác nhận trên điện thoại.

Nếu bấm Google rồi đứng ở `localhost:8080`, kiểm tra hạ tầng ngay cả khi backend
vẫn trả lời `/auth/session`. Redis cần hoạt động để lưu phiên OAuth. Chạy
`pnpm infra:up` và đợi MongoDB, Redis, MinIO healthy, sau đó đóng trang đăng nhập
đang chờ và bấm Google lại trong Dike. Nếu backend/web đã chiếm cổng 8080/3000,
không cần mở thêm một tiến trình `pnpm dev` chỉ để khởi động hạ tầng.

## Backend qua LAN hoặc tên miền

Đặt `EXPO_PUBLIC_API_URL` trong `apps/mobile/.env.local` tới API điện thoại truy cập
được. Luồng trình duyệt Google cần tới được `DIKE_AUTH_PUBLIC_BASE_URL` và callback
đã đăng ký trong Google Console. Nên dùng cùng public origin cho API, web và callback
để giữ đúng cookie OAuth. Tunnel của Metro chỉ phục vụ bundle, không public backend.

Để chạy không dây trên mạng trường, public web local cổng 3000 qua HTTPS; web
chuyển tiếp `/api/v1` tới backend local. Ví dụ public URL là `https://dike.example.com`:

- `.env.local` ở gốc repo:
  `DIKE_AUTH_PUBLIC_BASE_URL=https://dike.example.com`,
  `DIKE_AUTH_ALLOWED_ORIGINS=https://dike.example.com` và
  `DIKE_SESSION_COOKIE_SECURE=true`.
- Google Console, Authorized redirect URIs:
  `https://dike.example.com/api/v1/auth/callback/google`.
- `apps/mobile/.env.local`:
  `EXPO_PUBLIC_API_URL=https://dike.example.com/api/v1` và
  `EXPO_PUBLIC_ANDROID_USB_LOCALHOST=false`.
- Khởi động lại `pnpm dev` và `pnpm dev:mobile --tunnel --clear`.

Thay URL ví dụ bằng URL HTTPS thực tế. Nếu tunnel đổi tên miền, cập nhật cả ba
nơi trên. Dùng cùng hostname từ bước bắt đầu đăng nhập đến callback để giữ cookie.
Thử Google login trên web với URL này trước khi thử trong Dike.

Tìm địa điểm và tính tuyến đường thật còn cần `DIKE_GOONG_API_KEY` ở backend.
Mặc định local dùng OTP provider `fake`; muốn gửi SMS thật cần cấu hình nhà cung
cấp OTP đang được backend hỗ trợ. Việc dùng API thật không tự cấp quyền tài xế
hay thay thế các bước xác minh tài khoản.

## Tạo development build

Home dùng MapLibre với nền OpenFreeMap Positron và tuyến đã lưu từ API, giống web.
Sau khi cập nhật dependency `react-native-webview`, cần build và cài lại APK development;
reload Metro không bổ sung được module native vào APK cũ. APK cũ hiển thị lời nhắc
cập nhật ứng dụng ở vị trí bản đồ, thay vì làm lỗi toàn bộ Home.

Nếu đã có Android SDK đầy đủ (platform, build-tools và các thành phần Gradle yêu cầu):

```powershell
pnpm --filter @dike/mobile android
```

Expo tự sinh native project bằng CNG; không chỉnh native project bằng tay.
Nếu chỉ có `platform-tools`, lệnh trên chưa đủ điều kiện build APK.

Có thể dùng EAS với tài khoản Expo đã đăng nhập:

```powershell
cd apps/mobile
npx eas-cli@latest build --profile development --platform android
```

Cần cấu hình project và signing theo tài khoản của chủ dự án.
Không đưa OAuth client secret vào biến `EXPO_PUBLIC_*` hoặc ứng dụng mobile.

## Kiểm tra

```powershell
pnpm --filter @dike/mobile lint
pnpm --filter @dike/mobile typecheck
pnpm --filter @dike/mobile e2e
pnpm --filter @dike/mobile build
```

E2E dùng Chromium ở kích thước điện thoại và API kiểm thử, không thay thế Google
login thật, quyền hệ thống, bàn phím hay safe area trên Android/iOS. Kế hoạch và
các giới hạn kiểm chứng được ghi tại `docs/architecture/mobile-ui-plan.md`.
