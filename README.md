# Dike

Dike là nền tảng kết nối người có xe và người cần đi nhờ theo tuyến đường, thời gian và cộng đồng phù hợp. Mục tiêu hiện tại là một production pilot có kiểm soát cho tối đa khoảng 500 người dùng.

## Trạng thái

Repository được xây mới theo hướng greenfield. Source, dữ liệu và Git history của
prototype cũ không được khôi phục hoặc migrate. Stage 1 cung cấp app shell, modular
backend, local infrastructure, transaction/outbox foundation và contract sinh tự
động. Stage 2 đã có Google OAuth, session Redis, nhập số điện thoại chưa xác minh
và UI quản lý phiên; nghiệm thu Docker/Google thật và browser E2E còn pending.

## Kiến trúc đã chọn

- Web: React và Next.js.
- Backend: Java 21, Spring Boot Modular Monolith, REST/OpenAPI và WebSocket/STOMP.
- Mobile: Flutter/Dart, dùng chung backend và OpenAPI contract với web.
- Dữ liệu: MongoDB là primary store; Redis cho session/cache/presence; R2 cho object storage.
- API và worker dùng chung codebase, domain model và release cycle.

## Prerequisite

- Git.
- Node.js 24.21.0.
- Corepack và pnpm 12.9.1.
- Java 21.
- Docker Desktop dùng WSL 2 và Docker Compose v2.

Maven 3.9.10 được cung cấp qua Maven Wrapper.

Trên Windows, nếu PowerShell chặn `npm.ps1`, dùng `corepack`, `pnpm.cmd` hoặc executable `.cmd`; không cần thay đổi execution policy toàn hệ thống.

## Bootstrap và kiểm tra

Windows PowerShell:

```powershell
corepack enable
corepack prepare pnpm@12.9.1 --activate
pnpm install --frozen-lockfile
pnpm setup:repo
pnpm check
.\mvnw.cmd -B -ntp verify
```

Linux/macOS/CI:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm setup:repo
pnpm check
./mvnw -B -ntp verify
```

`verify` chạy integration test bằng MongoDB replica set thật qua Testcontainers,
vì vậy Docker Engine phải sẵn sàng. Nếu chỉ cần kiểm tra nhanh Java khi đang sửa
code, dùng `-DskipITs test`; CI và gate trước khi merge vẫn phải chạy `verify`.

## Chạy môi trường local

Sao chép `.env.local.example` thành file cấu hình local của riêng bạn nếu cần đổi
giá trị mặc định. Không commit file chứa credential.

```powershell
pnpm dev
```

Lệnh trên kiểm tra Docker và port, đợi MongoDB/Redis/MinIO healthy, build một JAR,
sau đó chạy API, worker và web với log có prefix. Nhấn `Ctrl+C` để dừng các process
Dike; volume local được giữ lại.

Có thể chạy từng phần để debug:

```powershell
pnpm infra:up
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

| Dịch vụ         | Địa chỉ                                           |
| --------------- | ------------------------------------------------- |
| Web             | `http://localhost:3000`                           |
| API             | `http://localhost:8080/api/v1`                    |
| Liveness        | `http://localhost:8080/actuator/health/liveness`  |
| Readiness       | `http://localhost:8080/actuator/health/readiness` |
| OpenAPI         | `http://localhost:8080/api/openapi.json`          |
| MongoDB         | `localhost:27017`                                 |
| Redis           | `localhost:6379`                                  |
| MinIO / console | `http://localhost:9000` / `http://localhost:9001` |

`pnpm infra:reset` xóa đúng volume của Compose project Dike và làm mất toàn bộ dữ
liệu local. Lệnh này không được gọi tự động.

## Contract API

`docs/api/openapi.json` là artifact OpenAPI được review. TypeScript contract trong
`packages/api-client-ts/src/generated` không sửa tay:

```powershell
pnpm api:generate
pnpm api:check
```

`api:generate` cần Java 21: chạy backend trong test context để xuất OpenAPI rồi
sinh kiểu dữ liệu và route/method TypeScript. `api:check` kiểm tra artifact → TS;
Maven `verify` kiểm tra toàn bộ runtime contract → artifact. Không sửa JSON hoặc
client sinh ra để che drift từ controller.

## Google login và Stage 2

Cấu hình `DIKE_GOOGLE_CLIENT_ID`, `DIKE_GOOGLE_CLIENT_SECRET` trong environment
của API. Đăng ký callback `http://localhost:8080/api/v1/auth/callback` trong OAuth
client Google dùng cho local. Web mặc định ở `http://localhost:3000`; URL cấu hình
qua `DIKE_AUTH_WEB_URL` và `DIKE_AUTH_CALLBACK_URL`. Không commit credential.

Vào `/login`, đăng nhập Google, nhập số điện thoại rồi mở `/account/sessions` để
làm mới hoặc thu hồi phiên. Khi chưa cấu hình Google, endpoint trả lỗi khả dụng;
không có tài khoản hoặc header đăng nhập giả. Số điện thoại vẫn chưa xác minh.

Staging/production yêu cầu HTTPS, cấu hình Google đầy đủ và
`REQUIRE_PHONE_OTP=true`. Chưa nghiệm thu Stage 2 không đồng nghĩa sẵn sàng pilot;
xem các gate còn thiếu trong runbook.

## Xử lý lỗi thường gặp trên Windows

- Git client báo sai Node dù terminal dùng đúng phiên bản: chạy `pnpm setup:repo`
  bằng Node 24.21.0. Lệnh này lưu đường dẫn Node vào Git config local
  `dike.nodePath`, để hook không phụ thuộc PATH cũ của Git client. Nếu di chuyển
  toolchain, chạy lại setup hoặc xóa cấu hình bằng
  `git config --local --unset dike.nodePath`.

- Docker đứng ở “Starting the Docker Engine”: thoát Docker Desktop, chạy
  `wsl --shutdown` bằng PowerShell Administrator rồi mở lại Docker. Thao tác này
  dừng tất cả distro WSL nhưng không xóa Docker volume.
- Maven báo sai Java: đặt `JAVA_HOME` tới JDK 21 trước khi chạy wrapper.
- Port đã được dùng: dừng process đang giữ port `3000`, `8080`, `27017`, `6379`,
  `9000` hoặc `9001`; không đổi riêng port Mongo vì replica-set member đang quảng
  bá `localhost:27017`.

## Tài liệu

- [Master plan](plan/PLAN_MASTER.md)
- [Stage 0 runbook](plan/STAGE_0.md)
- [Stage 1 runbook](plan/STAGE_1.md)
- [Stage 2 runbook và kết quả rà soát](plan/STAGE_2.md)
- [Architecture Decision Records](docs/architecture/adr/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

`PLAN_MASTER.md` là nguồn đặc tả duy nhất. GitHub Issues là backlog vận hành và không thay thế master plan.
