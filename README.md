# Dike

Dike là nền tảng kết nối người có xe và người cần đi nhờ theo tuyến đường, thời gian và cộng đồng phù hợp. Mục tiêu hiện tại là một production pilot có kiểm soát cho tối đa khoảng 500 người dùng.

## Trạng thái

Repository được xây mới theo hướng greenfield. Source, dữ liệu và Git history của prototype cũ không được khôi phục hoặc migrate. Stage 0 chỉ thiết lập governance, tooling và quality gate; ứng dụng bắt đầu được scaffold ở Stage 1.

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

Maven 3.9.10 được cung cấp qua Maven Wrapper. Docker chưa cần cho Stage 0.

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

## Tài liệu

- [Master plan](plan/PLAN_MASTER.md)
- [Stage 0 runbook](plan/STAGE_0.md)
- [Architecture Decision Records](docs/architecture/adr/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

`PLAN_MASTER.md` là nguồn đặc tả duy nhất. GitHub Issues là backlog vận hành và không thay thế master plan.
