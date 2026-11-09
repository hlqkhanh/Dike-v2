# Deploy Dike lên Render, Vercel và MongoDB Atlas

## Trạng thái đã kiểm tra ngày 28/10/2026

Chủ tài khoản đã chốt **demo miễn phí**, không kích hoạt dịch vụ có overage billing.
Dùng `infra/render-demo.yaml`, profile `demo,combined`, API và worker chung tiến trình.
Không dùng `infra/render.yaml` cho demo vì blueprint đó tạo worker trả phí.

## Cấu hình demo hiện tại

- Google login, session first-party qua Vercel, cookie HTTPS `__Host-DIKE_SESSION`.
- Thành viên mới giữ quyền thông thường; không giả lập VERIFIED_MEMBER/APPROVED_DRIVER.
- OTP và upload/download file bị chặn với `DEMO_FEATURE_DISABLED`.
  Định tuyến dùng Goong thật cho thành viên đã đăng nhập, không cần xác minh OTP.
  API key Goong chỉ đặt trên backend; cache và giới hạn tần suất vẫn được áp dụng.
- Không cần R2/S3. Readiness demo chỉ kiểm tra MongoDB và Redis; health indicator
  storage không được đăng ký trong profile demo.
- Redis dùng hostname nội bộ `red-dbgs50cs728c73c8o6n0`, port 6379, cùng Render
  Singapore. Không mở external access và không tắt TLS của staging/production.
- Demo đặt `spring.session.data.redis.configure-action=none` vì Render không
  cho ứng dụng gọi `CONFIG GET/SET`. Không đổi quyền Redis để vượt hạn chế này.
- Render tự cung cấp commit SHA và public hostname; profile demo dùng chúng cho
  service version và WebSocket URL. Không đoán tên miền trước khi tạo service.
- Chủ tài khoản nhập MongoDB URI, Google client secret và `DIKE_GOONG_API_KEY`
  trên Render. Blueprint sinh `DIKE_ROUTING_CACHE_KEY_SECRET` và hai OTP signing
  secrets tự động, dù SMS đã bị vô hiệu hóa.
- Vercel cần `DIKE_WEB_DEMO=true` và `DIKE_API_INTERNAL_ORIGIN` bằng URL API thực tế;
  deploy frontend từ cùng nhánh/commit sau khi backend đã sẵn sàng.
- Render Free có thể ngủ khi không có truy cập; worker cũng tạm dừng. Không quảng
  bá demo là môi trường production hoặc hứa tác vụ nền chạy liên tục.

Không kết hợp profile demo với local, staging, production, api hoặc worker.
Profile `combined` là profile workload duy nhất dùng cùng `demo`.

## Sửa lỗi khởi động demo: dike.routing.provider

Nếu log báo `Secure hosted configuration is required for property: dike.routing.provider`,
image demo cũ yêu cầu routing bị tắt. Bản mới dùng Goong thật: cần push code mới
và deploy commit chứa thay đổi validator, filter và profile demo cùng nhau.

Trong Environment của service `dike-api-demo`, đặt `DIKE_ROUTING_PROVIDER=goong`,
`DIKE_GOONG_API_KEY` bằng API key Goong thật, `DIKE_ROUTING_CACHE_KEY_SECRET` bằng
secret ngẫu nhiên riêng và `DIKE_ROUTING_ALLOW_UNVERIFIED_MEMBERS=true`.
Giữ `SPRING_PROFILES_ACTIVE=demo,combined`. Đồng bộ `infra/render-demo.yaml` nếu
quản lý bằng Blueprint; cache secret sẽ được sinh tự động. Không commit API key.
Chỉ đổi biến môi trường trên image cũ sẽ vẫn bị validator từ chối.
Sau deploy, kiểm tra `/actuator/health/readiness` trả `UP` và tiến trình không còn
thoát với status 1 sau dòng `Started DikeApplication`.

## Các yêu cầu riêng của staging (không áp dụng cho demo)

Nếu sau này triển khai staging thật, vẫn cần giải quyết các điều kiện dưới đây:

- `FakeOtpProvider` là implementation `OtpProvider` duy nhất; staging từ chối
  provider `fake`. Cần triển khai adapter SMS thật và kiểm tra delivery.
- `BasicFileContentInspector` là implementation `FileContentInspector` duy nhất;
  staging từ chối inspector `basic`. Đổi tên cấu hình không tạo ra adapter mới.
- Staging yêu cầu API và worker riêng. Render không có worker miễn phí. Blueprint
  `infra/render.yaml` hiện chọn `starter` cho cả hai; không áp dụng blueprint này
  nếu chưa chấp nhận chi phí.
- Cần Redis và S3/R2 ngoài MongoDB. Readiness kiểm tra cả MongoDB, Redis và storage.

Không dùng profile `local` trên Internet để vượt các kiểm tra staging. Không bật
dev login hoặc simulated full access trên bản deploy này.

Chủ tài khoản đã đăng nhập Cloudflare nhưng **từ chối kích hoạt R2 subscription**
vì không chấp nhận nguy cơ tính phí vượt hạn mức. Không bấm kích hoạt R2 hoặc tạo
tài nguyên trả phí. Tài khoản Cloudflare: `f9aa775e18bfc533c2e70a8d585026ee`.
Trang R2 hiện dừng ở bước chọn subscription; chưa có bucket hay R2 access key.
Yêu cầu không phát sinh phí được xử lý bằng profile demo riêng; không thay đổi
các guard của staging/production.

Đã tạo [Atlas project Dike](https://cloud.mongodb.com/v2/6ae149ca6a8b52c9631fc816#/overview)
và cluster `Dike`, Free, AWS Singapore. Atlas báo cluster sẵn sàng. Đã xác minh user
`dike`, SCRAM, có quyền `readWrite` trên database `dike`; dùng tên database này khi
nhập cấu hình Render. Chủ tài khoản đã xác nhận và đã thêm hai dải outbound
Render Singapore `74.220.52.0/24`, `74.220.60.0/24`; không mở `0.0.0.0/0`.

Đã tạo [Render Key Value dike-redis-staging](https://dashboard.render.com/r/red-dbgs50cs728c73c8o6n0),
Free, Singapore, `noeviction`, trạng thái Available. External access vẫn bị chặn;
đã cấu hình API dùng hostname nội bộ. Gói Free không lưu dữ liệu qua restart.

Google project `dike-510901` đã có Branding, External/Testing, test users và client
`Dike Local Web`. Đã tạo thêm client `Dike Staging Web`, chỉ có origin
`https://dike-v2.vercel.app` và callback
`https://dike-v2.vercel.app/api/v1/auth/callback/google`. Client ID:
`48551220762-r2n82s3p0fbnrmam7eoulcuqd4pshqbl.apps.googleusercontent.com`.
Client secret không được ghi vào repository; chủ tài khoản lưu trực tiếp từ Google.

Vercel đã deploy frontend `apps/web` lên Production từ nhánh
`codex/free-demo-deployment`, commit `3ea10eb28a4ede124431db4f80ca334e1931d52a`.
Deployment `dike-v2-do3eepn2t-khanh-hos-projects-c0a513fe.vercel.app` báo Ready.
Domain cố định: [dike-v2.vercel.app](https://dike-v2.vercel.app). Trang login đã
hiển thị thông báo demo, với `DIKE_WEB_DEMO=true` và upstream
`DIKE_API_INTERNAL_ORIGIN=https://dike-api-demo.onrender.com`.

Đã tạo Render Free web service `dike-api-demo`, ID `srv-dbgvs1etlv9c73dh1t0g`,
URL [dike-api-demo.onrender.com](https://dike-api-demo.onrender.com), Blueprint
`dike-free-demo`, path `infra/render-demo.yaml`. Chủ tài khoản tự nhập hai secret
trên Render. Đã sửa lỗi khởi động `NOPERM config|get` bằng biến
`SPRING_SESSION_DATA_REDIS_CONFIGURE_ACTION=none`. Image cũ có mặc định
`DIKE_SERVICE_VERSION=dev`, nên cấu hình release hiện tại đặt SHA commit tường
minh; profile demo mới ưu tiên `RENDER_GIT_COMMIT`. Render đã báo Live;
liveness/readiness trả `UP`, OpenAPI kiểm tra thành công. Qua domain Vercel,
OAuth chuyển đến Google với callback đúng, PKCE S256 và cookie Secure/HttpOnly;
file/OTP/routing trả 503 `DEMO_FEATURE_DISABLED` theo thiết kế tại thời điểm đó.
Routing ở bản mới đã chuyển sang Goong thật như cấu hình ở trên; cần kiểm tra lại
luồng tìm địa điểm và tính tuyến sau khi deploy.

Lần đăng nhập bằng trình duyệt quay về `OIDC_LOGIN_FAILED`, nên chưa xác nhận
luồng đăng nhập hoàn tất. Bản chẩn đoán chỉ ghi mã OAuth từ danh sách cố định,
không ghi exception message, token, claims hay response của nhà cung cấp.

## MongoDB Atlas

1. Tạo project `Dike`, tách khỏi project `MIROIR` hiện có dữ liệu.
2. Chọn cluster **Free**, AWS Singapore nếu khả dụng; không bật dịch vụ trả phí.
3. Database user `dike` đã có `readWrite` trên database `dike`.
   Chủ tài khoản tự nhập mật khẩu trong Atlas; không gửi mật khẩu vào chat.
4. Network Access chỉ cho phép outbound IP ranges của dịch vụ Render, lấy từ
   dashboard sau khi chọn region. Không mặc định mở `0.0.0.0/0`.
5. Đặt URI driver `mongodb+srv://...` trong secret `DIKE_MONGODB_URI` của Render,
   database trong `DIKE_MONGODB_DATABASE=dike`, khớp quyền user đã tạo.
   URL-encode ký tự đặc biệt
   trong username/password. Không mang `replicaSet=rs0` từ local sang Atlas.
6. Ứng dụng tự chạy migration/index khi khởi động. Không import dữ liệu MIROIR.

## Render

- Repository: `hlqkhanh/Dike-v2`; Docker context và Root Directory tại repository
  root; Dockerfile `./Dockerfile`.
- Demo dùng `infra/render-demo.yaml`; phần dưới là cấu hình staging trả phí,
  chỉ áp dụng khi chủ tài khoản đổi yêu cầu và chấp nhận chi phí.
- Blueprint staging: `infra/render.yaml`; region Singapore.
- API: `SPRING_PROFILES_ACTIVE=staging,api`, `DIKE_WORKLOAD=api`.
- Worker: `SPRING_PROFILES_ACTIVE=staging,worker`, `DIKE_WORKLOAD=worker`.
- Dùng cùng release cho API/worker, đặt `DIKE_SERVICE_VERSION` bằng commit SHA.
- API health check: `/actuator/health/readiness`; ứng dụng đã đọc biến `PORT`.
- Nhập đầy đủ secrets trong blueprint. Bổ sung các biến trong bảng dưới đây để
  không dùng mặc định local. Chỉ deploy khi đã có adapter OTP/scanner thật.

| Biến                            | Giá trị staging                             |
| ------------------------------- | ------------------------------------------- |
| `DIKE_AUTH_PUBLIC_BASE_URL`     | Origin HTTPS cố định của frontend Vercel    |
| `DIKE_AUTH_ALLOWED_ORIGINS`     | Cùng origin frontend, không có dấu `/` cuối |
| `DIKE_REALTIME_ALLOWED_ORIGINS` | Cùng origin frontend                        |
| `DIKE_WEBSOCKET_URL`            | `wss://<render-api-host>/ws`                |
| `DIKE_OTP_PROVIDER`             | Tên adapter thật đã triển khai              |
| `DIKE_OTP_HMAC_SECRET`          | Secret ngẫu nhiên riêng cho staging         |
| `DIKE_OTP_RATE_KEY_SECRET`      | Secret ngẫu nhiên khác HMAC secret          |
| `DIKE_OTP_KEY_VERSION`          | `staging-v1`                                |
| `DIKE_FILE_INSPECTOR`           | Tên adapter scanner thật đã triển khai      |
| `DIKE_PUBLIC_OBJECT_BASE_URL`   | URL HTTPS phục vụ avatar public             |
| `DIKE_ROUTING_CACHE_KEY_SECRET` | Secret ngẫu nhiên riêng                     |
| `DIKE_RIDE_BOARDING_KEY`        | Base64 của 32 random bytes                  |
| `DIKE_TERMS_URL`                | URL HTTPS trang điều khoản đã xuất bản      |
| `DIKE_PRIVACY_URL`              | URL HTTPS trang quyền riêng tư đã xuất bản  |
| `DIKE_DEMO_SEED_ENABLED`        | `false`                                     |

Staging bật Redis TLS. Nếu nhà cung cấp yêu cầu authentication, cấu hình thêm
`SPRING_DATA_REDIS_USERNAME` và `SPRING_DATA_REDIS_PASSWORD` bằng secret. Render
Key Value Free dùng kết nối nội bộ có đặc điểm TLS khác; không ghép mặc định với
profile staging vốn yêu cầu TLS mà chưa xác minh kết nối.

Storage cần hai bucket public/private và CORS theo
[runbook storage](file-storage-and-account-deletion.md). Không lưu ảnh trong
filesystem tạm của Render.

## Vercel

1. Import repository dưới dạng **một frontend**, chọn Root Directory `apps/web`,
   Application Preset **Next.js**, Node.js **24.x**, gói Hobby.
2. Bật include source files outside Root Directory nếu dashboard hiển thị tùy chọn
   này; frontend dùng workspace packages từ `packages/*`.
3. `apps/web/vercel.json` pin lệnh install/build qua Corepack để dùng đúng pnpm
   trong `packageManager` của repository. Không import Docker backend vào Vercel.
4. Đặt `DIKE_API_INTERNAL_ORIGIN=https://<render-api-host>` trước khi build.
   Không thêm `/api`; Next.js đọc biến này khi build rewrite nên phải redeploy
   nếu thay upstream.
5. Giữ `NEXT_PUBLIC_DIKE_API_BASE_URL` không được đặt để browser gọi `/api/v1`
   qua same-origin proxy. Không đưa Mongo URI hoặc backend secrets lên frontend.
6. Đăng ký Google OAuth callback
   `https://<vercel-host>/api/v1/auth/callback/google`; đặt Google client ID/secret
   trên backend. Chỉ allowlist domain frontend cố định dùng cho staging.

## Xác minh sau deploy

```powershell
corepack pnpm smoke:deployment -- https://<render-api-host>
```

Kiểm tra frontend, Google login qua `/api`, reload session, CSRF mutation, logout,
WebSocket, SMS delivery và upload ảnh theo các runbook hiện có. Frontend build
thành công chưa chứng minh backend hay toàn bộ luồng người dùng hoạt động.

Render Free ngủ sau 15 phút không có traffic; worker chung tiến trình cũng sẽ
ngừng khi dịch vụ ngủ. Đây không đáp ứng yêu cầu worker staging chạy riêng.

## Tài liệu nhà cung cấp

- [Render Free và giới hạn worker](https://render.com/docs/free)
- [Render Blueprint](https://render.com/docs/blueprint-spec)
- [Vercel monorepo](https://vercel.com/docs/monorepos)
- [Vercel package managers](https://vercel.com/docs/package-managers)
- [Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
