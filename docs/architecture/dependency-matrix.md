# Dependency matrix

Ngày xác minh: 06/10/2026

Các phiên bản dưới đây là baseline của Stage 1. Mọi thay đổi major/minor phải được
kiểm tra compatibility và cập nhật tài liệu này cùng lockfile.

| Thành phần          | Phiên bản | Nguồn tương thích                                      |
| ------------------- | --------- | ------------------------------------------------------ |
| Java                | 21        | ADR 0002                                               |
| Maven Wrapper       | 3.9.10    | ADR 0002                                               |
| Spring Boot         | 4.1.1     | Spring Boot stable                                     |
| Spring Modulith     | 2.1.1     | Spring Modulith BOM cho Spring Boot 4.x                |
| springdoc-openapi   | 3.1.1     | Nhánh 3.x hỗ trợ Spring Boot 4.x                       |
| ArchUnit            | 1.4.1     | Test dependency, pin trực tiếp                         |
| Testcontainers Java | 1.21.3    | Test dependency, dùng BOM                              |
| AWS SDK for Java    | 2.42.23   | S3-compatible adapter, dùng BOM                        |
| Spring Security     | Boot BOM  | OAuth2 Client/OIDC và servlet authorization            |
| Spring Session      | Boot BOM  | Redis indexed repository cho opaque web session        |
| libphonenumber      | 9.0.17    | Chuẩn hóa số Việt Nam sang E.164                       |
| Node.js             | 24.21.0   | Stage 0 toolchain                                      |
| pnpm                | 12.9.1    | Root `packageManager`                                  |
| Next.js             | 16.3.8    | Active LTS, gồm bản vá bảo mật tháng 09/2026           |
| React / React DOM   | 19.3.0    | Registry stable tương thích Next.js 16.3               |
| TypeScript          | 6.0.3     | Bản mới nhất trong peer range của typescript-eslint    |
| ESLint              | 9.39.5    | Bản maintenance mới nhất hỗ trợ bởi Next plugins       |
| Playwright          | 1.63.0    | Chromium desktop/mobile cho Stage 2 browser E2E        |
| MongoDB image       | 8.0.32    | MongoDB 8.0 patch pin cho local                        |
| Redis image         | 8.10.2    | Redis patch pin cho local                              |
| MinIO image         | 2025.7.23 | Bitnami legacy; local/test only, không dùng production |

## Quy tắc quản lý

- Java dependency ưu tiên version do Spring Boot và Spring Modulith BOM quản lý.
- Chỉ pin trực tiếp dependency nằm ngoài BOM hoặc cần khóa để build tái lập.
- JavaScript dependency phải được khóa bằng `pnpm-lock.yaml` và cài bằng frozen
  lockfile trong CI.
- Docker image không dùng tag `latest`; version/digest được ghi cạnh service trong
  Compose.
- Chỉ `unrs-resolver` được phép chạy install script trong pnpm workspace; đây là
  native resolver của lint toolchain và không nằm trong application runtime.
- Không override dependency bảo mật/transitive chỉ để bỏ cảnh báo build.

## Lưu ý môi trường local

Máy phát triển hiện có JDK 21 tại `C:\Program Files\Java\jdk-21.0.8`. Terminal mặc
định có thể trỏ tới Java 24, vì vậy lệnh Maven local phải đặt `JAVA_HOME` về JDK 21
hoặc dùng shell đã cấu hình đúng. Node cài toàn hệ thống hiện không thay thế baseline
CI Node 24.21.0; CI và fresh-clone gate vẫn chạy đúng phiên bản đã khóa.
