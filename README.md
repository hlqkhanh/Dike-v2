# Dike

Dike là nền tảng kết nối người có xe và người cần đi nhờ theo tuyến đường, thời gian và cộng đồng phù hợp. Mục tiêu hiện tại là một production pilot có kiểm soát cho tối đa khoảng 500 người dùng.

## Trạng thái

Repository được xây mới theo hướng greenfield. Source, dữ liệu và Git history của
prototype cũ không được khôi phục hoặc migrate. Stage 1 cung cấp app shell, modular
backend, local infrastructure, transaction/outbox foundation và contract sinh tự
động. Stage 2 bổ sung Google OIDC, Redis-backed opaque session, phone onboarding
và luồng đăng nhập web qua same-origin proxy.

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

Để đăng nhập Google thật, tạo OAuth Web Client dành riêng cho development và đăng
ký callback `http://localhost:3000/api/v1/auth/callback/google`, sau đó đặt client
ID/secret trong môi trường local. Không dùng credential production ở local.

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
| API qua web     | `http://localhost:3000/api/v1`                    |
| API trực tiếp   | `http://localhost:8080/api/v1`                    |
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

## Xử lý lỗi thường gặp trên Windows

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
- [Stage 2 runbook](plan/STAGE_2.md)
- [Stage 3 runbook — OTP và phân quyền](plan/STAGE_3.md)
- [Web auth proxy](docs/architecture/auth/web-same-origin-proxy.md)
- [Google OAuth smoke test](docs/runbooks/google-oauth-smoke.md)
- [Architecture Decision Records](docs/architecture/adr/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

`PLAN_MASTER.md` là nguồn đặc tả duy nhất. GitHub Issues là backlog vận hành và không thay thế master plan.
