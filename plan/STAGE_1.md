# STAGE 1 — Nền tảng backend và local infrastructure

Ngày lập kế hoạch: 05/10/2026  
Trạng thái: Implementation complete; Docker-backed acceptance pending CI  
Điều kiện bắt đầu: Stage 0 đã đóng theo `STAGE_0.md`

Tài liệu này là runbook triển khai Stage 1. `PLAN_MASTER.md` vẫn là nguồn đặc tả
sản phẩm và kiến trúc cao nhất; nếu runbook này mâu thuẫn với master plan hoặc ADR
đã Accepted thì master plan và ADR được ưu tiên, đồng thời phải sửa runbook trong
cùng thay đổi.

## 1. Mục tiêu

Stage 1 tạo nền kỹ thuật có thể chạy và kiểm thử lặp lại cho các stage nghiệp vụ:

- Monorepo có web Next.js, backend Spring Boot Modular Monolith và các package
  TypeScript dùng chung.
- Backend có hai workload profile `api` và `worker` từ cùng source và cùng
  artifact.
- Local infrastructure gồm MongoDB replica set, Redis và MinIO, không phụ thuộc
  dịch vụ production.
- MongoDB transaction, index migration và outbox at-least-once có bằng chứng bằng
  integration test trên dependency thật.
- OpenAPI do backend sinh ra là nguồn duy nhất cho TypeScript API client.
- Web có app shell Urban Mint tối thiểu, chưa có màn hình hoặc logic nghiệp vụ.
- Quality gate local và CI kiểm tra kiến trúc module, contract sinh tự động,
  backend, web và infrastructure.

Stage này tạo nền tảng, không tạo lát cắt nghiệp vụ giả để chứng minh framework.

## 2. Quyết định và ranh giới đã khóa

### 2.1. Stack và cấu trúc

- Java 21, Maven Wrapper 3.9.10 và Spring Boot 4.1.x.
- Spring MVC, Spring Data MongoDB, Spring Data Redis, Spring Modulith, Jakarta
  Validation, Actuator, Micrometer và springdoc OpenAPI.
- Next.js App Router, React và TypeScript strict.
- pnpm workspace quản lý `apps/web` và `packages/*`; backend vẫn do Maven quản lý.
- MongoDB local/test phải là replica set; không chấp nhận Mongo standalone cho
  transaction test.
- Redis và MinIO chỉ là dependency local/test trong Stage 1. MongoDB vẫn là nguồn
  trạng thái chính.
- Dependency và image phải pin phiên bản cụ thể trong lockfile/config khi triển
  khai. Không dùng tag image `latest`.

### 2.2. Ranh giới module backend

Tạo các application module trực tiếp dưới package `com.dike`:

- `identity`
- `community`
- `planning`
- `ride`
- `messaging`
- `trust`
- `shared`

Mỗi module nghiệp vụ có thể bắt đầu bằng package marker và cấu trúc rỗng, nhưng
ranh giới sau là bắt buộc:

1. `api` chỉ gọi `application`; controller không truy cập repository.
2. `domain` không phụ thuộc Spring MVC, MongoDB, Redis, MinIO hoặc SDK provider.
3. `infrastructure` triển khai port do module sở hữu.
4. Module không import package nội bộ của module khác.
5. `shared` chỉ chứa concern kỹ thuật; không chứa entity hoặc business service.
6. Modulith verification và ArchUnit là test bắt buộc, không phải tài liệu quy ước.

### 2.3. Runtime và cấu hình

- Environment profile: `local`, `test`, `staging`, `production`.
- Workload profile: `api`, `worker`.
- `api` mở HTTP, OpenAPI và health endpoint; không chạy outbox poller.
- `worker` đặt `spring.main.web-application-type=none`, chạy outbox poller và không
  mở HTTP public.
- Local được phép bật `local,api,worker` trong một JVM để phát triển, nhưng test
  phải chứng minh worker không phụ thuộc việc chạy chung process với API.
- Cấu hình dùng typed `@ConfigurationProperties` có validation. YAML chỉ chứa giá
  trị không nhạy cảm và placeholder; secret đọc từ environment.
- Production/staging không có fake auth, fake OTP hoặc bypass security. Các tính
  năng đó chưa được tạo trong Stage 1.

### 2.4. Public interface tối thiểu

Sau Stage 1 chỉ cam kết các interface nền tảng:

- `/actuator/health/liveness`
- `/actuator/health/readiness`
- OpenAPI document của `/api/v1` và TypeScript client được sinh từ document đó.
- Error envelope chuẩn:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "requestId": "..."
  }
}
```

Không tạo endpoint nghiệp vụ giả chỉ để làm đầy OpenAPI. Contract nền có thể mới
chỉ chứa metadata, security scheme tương lai và các schema dùng chung; operation
nghiệp vụ được thêm từ Stage 2.

### 2.5. Ngoài phạm vi

- Google login, session, CSRF policy hoàn chỉnh và OTP.
- Entity nghiệp vụ như `User`, `Trip`, `Booking`, `Message` hoặc API CRUD tương
  ứng.
- WebSocket/STOMP runtime và realtime destination; chỉ giữ dependency boundary để
  Stage 12 bổ sung.
- Goong, eKYC, Cloudflare R2 thật, email, SMS và push notification.
- Deploy Vercel/Render/Atlas, production domain, backup/restore và alerting.
- Flutter, Dart client và mobile application.
- Màn hình nghiệp vụ, mockup dữ liệu người dùng hoặc dữ liệu lấy từ prototype.

## 3. Cấu trúc đích sau Stage 1

```text
apps/
  backend/
    pom.xml
    src/main/java/com/dike/
      DikeApplication.java
      identity/
      community/
      planning/
      ride/
      messaging/
      trust/
      shared/
    src/main/resources/
      application.yml
      application-local.yml
      application-api.yml
      application-worker.yml
    src/test/java/com/dike/
  web/
    app/
    src/
    package.json
packages/
  api-client-ts/
  design-tokens/
  frontend-config/
  web-ui/
infra/
  docker-compose.yml
  docker/
  scripts/
docs/
  api/
  architecture/modules/
```

Không tạo `apps/mobile` hoặc `packages/api-client-dart` trong stage này.

## 4. Thứ tự triển khai và chiến lược tích hợp

Thực hiện theo các lát cắt nhỏ có thể review và luôn giữ `main` xanh:

1. Chốt dependency matrix và skeleton monorepo.
2. Dựng backend, module boundary và test kiến trúc.
3. Dựng local infrastructure và persistence foundation.
4. Thêm transaction proof, migration và outbox worker.
5. Thêm HTTP/error/observability foundation.
6. Dựng OpenAPI generation và TypeScript client.
7. Dựng web app shell và package giao diện dùng chung.
8. Hợp nhất one-command local workflow, CI và nghiệm thu sạch.

Mỗi work item dưới đây nên là một issue độc lập. PR sau chỉ bắt đầu khi dependency
trực tiếp đã merge hoặc dùng branch tích hợp được owner chỉ định. Không gom toàn bộ
Stage 1 vào một PR lớn.

## 5. Work breakdown

### S1-00 — Preflight và khóa dependency matrix

**Phụ thuộc:** Stage 0.  
**Mục tiêu:** loại bỏ rủi ro toolchain và Docker trước khi scaffold.

Thực hiện:

- Chạy lại `pnpm check` và Maven `verify` trên working tree sạch.
- Xác minh Docker Engine/Compose đọc được config hiện tại; xử lý known issue quyền
  đọc Docker đã ghi trong Stage 0 trước khi tiếp tục.
- Ghi dependency matrix vào tài liệu kỹ thuật: Spring Boot 4.1.x cụ thể, Spring
  Modulith tương thích, springdoc, Testcontainers, ArchUnit, OpenAPI Generator,
  Next.js, React và TypeScript.
- Kiểm tra compatibility từ BOM/release note chính thức; không override transitive
  dependency của Spring Boot nếu chưa có lý do và test.
- Pin Docker image bằng version cụ thể; với image production-sensitive nên ghi
  digest sau khi xác minh đa kiến trúc.
- Ghi rõ port mặc định, biến môi trường local và phương án tránh xung đột port.

**Hoàn thành khi:** dependency matrix được review; Docker preflight xanh trên máy
phát triển; không có dependency hoặc image dùng version nổi.

### S1-01 — Scaffold workspace và package nền frontend

**Phụ thuộc:** S1-00.

Thực hiện:

- Tạo `apps/web`, `packages/api-client-ts`, `packages/design-tokens`,
  `packages/frontend-config` và `packages/web-ui` đúng pnpm workspace.
- Mỗi package có `name`, `private`, `type`, `exports`, script `lint`, `typecheck`,
  `test` và `build` phù hợp; không publish nhầm package nội bộ.
- `frontend-config` cung cấp cấu hình TypeScript và ESLint dùng chung, tránh mỗi
  package tự sao chép cấu hình.
- Root scripts điều phối `format`, `lint`, `typecheck`, `test`, `build` và `check`
  theo workspace.
- Giữ generated code ngoài lint rule không phù hợp nhưng vẫn typecheck/build.

**Hoàn thành khi:** frozen install và toàn bộ script workspace chạy trên Windows và
CI Linux; package graph không có cycle.

### S1-02 — Scaffold Spring Boot modular monolith

**Phụ thuộc:** S1-00.

Thực hiện:

- Chuyển root Maven project thành parent/aggregator và thêm module
  `apps/backend`; giữ Enforcer, compiler release 21, Spotless và plugin version
  lock từ Stage 0.
- Tạo `DikeApplication` trong `com.dike` và sáu module nghiệp vụ cùng `shared`.
- Dùng package marker/Modulith metadata để public API của module là tường minh.
- Thêm cấu trúc `api`, `application`, `domain`, `infrastructure` khi module bắt đầu
  có code; không tạo class rỗng hàng loạt chỉ để lấp thư mục.
- Tạo tài liệu `docs/architecture/modules/README.md` mô tả ownership, public API và
  dependency được phép.

**Hoàn thành khi:** backend khởi động bằng Java 21, build thành một executable JAR
và Maven reactor chạy `verify` từ root.

### S1-03 — Architecture enforcement

**Phụ thuộc:** S1-02.

Thực hiện:

- Thêm Spring Modulith `ApplicationModules.verify()` test để phát hiện cycle và
  truy cập package nội bộ.
- Thêm ArchUnit rule tối thiểu:
  - class trong `..api..` không phụ thuộc `..infrastructure..` hoặc repository;
  - class tên `*Controller` chỉ phụ thuộc application/public contract;
  - `..domain..` không phụ thuộc framework/persistence/provider;
  - module nghiệp vụ không truy cập internal package của module khác;
  - `shared` không chứa type được đánh dấu aggregate/entity nghiệp vụ.
- Thêm fixture vi phạm trong source test hoặc compile-testing để chứng minh rule
  thực sự đỏ, không commit code vi phạm vào main source.
- Xuất tài liệu module do Modulith tạo ra nếu output ổn định và hữu ích; không coi
  sơ đồ sinh ra là gate thay cho verification test.

**Hoàn thành khi:** verification xanh với source thật và negative test chứng minh
ít nhất ba nhóm vi phạm bị bắt.

### S1-04 — Local infrastructure bằng Docker Compose

**Phụ thuộc:** S1-00.

Thực hiện:

- Tạo Compose cho MongoDB replica set một node phục vụ local, Redis và MinIO.
- Có init script idempotent cho replica set, healthcheck thật và dependency order;
  không chỉ kiểm tra process còn sống.
- Tạo bucket public/private local bằng init container hoặc script idempotent.
- Dữ liệu persistent nằm trong path đã ignore; cung cấp lệnh reset có target cụ
  thể và cảnh báo mất dữ liệu.
- Tạo `.env.local.example` chỉ chứa giá trị giả, tên biến và hướng dẫn; không commit
  credential thật.
- Cung cấp lệnh `infra:up`, `infra:down`, `infra:logs` và `infra:reset` qua root
  script. `infra:reset` không chạy trong `dev` hoặc CI mặc định.

**Hoàn thành khi:** fresh local start đạt health cho ba dependency, restart không
làm hỏng replica set/bucket và reset chỉ xóa volume của project Dike.

### S1-05 — MongoDB, Redis, MinIO và configuration foundation

**Phụ thuộc:** S1-02, S1-04.

Thực hiện:

- Tạo typed configuration properties cho MongoDB, Redis, S3-compatible storage,
  outbox và service metadata; validate URL, bucket và timeout bắt buộc.
- Cấu hình `MongoTransactionManager`; tắt auto index creation.
- Tạo abstraction clock, ID và storage port ở vị trí sở hữu phù hợp; MinIO adapter
  không được rò SDK type vào domain/application.
- Tạo versioned index migration nhỏ do project sở hữu, có collection lưu migration
  ID và lock chống API/worker áp dụng cùng lúc. Migration phải idempotent và fail
  fast khi checksum của migration đã áp dụng bị thay đổi.
- Seed local/test là explicit command/profile, idempotent và chỉ dùng dữ liệu tổng
  hợp; startup production không tự seed.
- Thêm connectivity/health indicator nhưng chỉ readiness phụ thuộc dependency bắt
  buộc; liveness không chết chỉ vì dependency tạm thời lỗi.

**Hoàn thành khi:** app kết nối cả ba dependency; migration chạy lại an toàn;
configuration thiếu/sai thất bại với thông báo rõ và không in secret.

### S1-06 — Transaction proof trên MongoDB replica set

**Phụ thuộc:** S1-05.

Thực hiện:

- Tạo test-only aggregate/repository hoặc fixture infrastructure tối thiểu để kiểm
  chứng transaction mà không tạo entity nghiệp vụ sớm.
- Dùng Testcontainers MongoDB replica set thật, không dùng mock hoặc embedded
  Mongo thay thế.
- Test commit nhiều document thành công và rollback toàn bộ khi exception xảy ra.
- Test unique/index constraint từ migration và optimistic/conditional write mẫu.
- Test parity giữa connection settings local và container test ở các thuộc tính có
  ảnh hưởng transaction.

**Hoàn thành khi:** test thất bại nếu chạy Mongo standalone hoặc bỏ
`MongoTransactionManager`, và xanh ổn định trong CI.

### S1-07 — API/worker profiles và outbox foundation

**Phụ thuộc:** S1-05, S1-06.

Thực hiện:

- Tạo `OutboxEvent` với tối thiểu `eventId`, `eventType`, `aggregateType`,
  `aggregateId`, `payloadVersion`, `payload`, `status`, `attempts`,
  `nextAttemptAt`, `lockedUntil`, `createdAt` và `completedAt`.
- Ghi domain state và outbox trong cùng Mongo transaction.
- Worker claim bằng atomic `findAndModify`, dùng lease; lease hết hạn cho phép
  worker khác claim lại.
- Retry exponential backoff có jitter, giới hạn attempts và trạng thái `FAILED`;
  clock/random được inject để test deterministic.
- Registry ánh xạ `eventType` + `payloadVersion` tới handler; unknown version không
  được đánh dấu thành công.
- Tạo handler mẫu idempotent dưới dạng projection/test effect, dùng `eventId` hoặc
  business key làm unique key. Không gọi provider bên ngoài trong transaction.
- API profile không khởi chạy poller; worker profile không mở web server. Shutdown
  ngừng claim mới và xử lý/nhả lease an toàn.

**Hoàn thành khi:** integration test chứng minh atomic rollback, một event không bị
hai worker claim đồng thời, retry sau lỗi, reclaim sau lease timeout và chạy handler
lặp không tạo tác dụng trùng.

### S1-08 — HTTP foundation, error contract và observability

**Phụ thuộc:** S1-02, S1-05.

Thực hiện:

- Đặt base path production API dưới `/api/v1` mà không tạo business endpoint giả.
- Tạo global exception handler cho validation, malformed request, conflict, not
  found, forbidden và lỗi không mong đợi; mapping error code ổn định.
- Không trả stack trace, class name hoặc chi tiết dependency ra response.
- Middleware tạo/validate `requestId`; propagate `correlationId` và `causationId`
  tới log/outbox. Không tin trực tiếp giá trị header chưa sanitize.
- Log JSON gồm timestamp UTC, level, service version, environment, workload,
  request/event ID và error code; thêm redaction test cho token, OTP, điện thoại và
  dữ liệu nhạy cảm.
- Actuator chỉ public liveness/readiness tối thiểu; endpoint chi tiết bị chặn hoặc
  không expose.
- Thêm metric nền cho HTTP, Mongo transaction, outbox backlog/age, claim/retry và
  handler failure.

**Hoàn thành khi:** contract test xác nhận error envelope/request ID; log test không
rò secret; health phản ánh đúng dependency và workload.

### S1-09 — OpenAPI và generated TypeScript client

**Phụ thuộc:** S1-01, S1-08.

Thực hiện:

- Cấu hình OpenAPI metadata, `/api/v1`, schema lỗi chung và security scheme dự kiến
  mà không tuyên bố endpoint Stage 2 đã tồn tại.
- Sinh OpenAPI JSON ở bước build/test có output deterministic vào `docs/api/`.
- Pin OpenAPI Generator và config cho `packages/api-client-ts`; generated code
  không được sửa tay.
- Chuẩn bị config/template trung lập để Stage 16 có thể sinh Dart client từ cùng
  document; chưa tạo Dart package.
- Root script `api:generate` sinh document và TypeScript client; `api:check` sinh
  vào thư mục tạm rồi fail nếu Git-tracked output khác.
- Client có một nơi cấu hình base URL, credential/cookie và request ID; UI không tự
  ghép URL hoặc sao chép response type.

**Hoàn thành khi:** generation chạy giống nhau trên Windows/CI Linux, chạy hai lần
không sinh diff và thay đổi contract chưa regenerate bị CI chặn.

### S1-10 — Next.js app shell và Urban Mint design foundation

**Phụ thuộc:** S1-01.

Thực hiện:

- Bootstrap Next.js App Router với TypeScript strict và server/client boundary rõ.
- `design-tokens` chứa token trung lập nền tảng: màu, typography, spacing, radius,
  elevation và motion; không chứa React component.
- `web-ui` chứa primitive React tối thiểu dùng token: button, input, card, status
  và layout shell; có focus-visible, label và contrast phù hợp.
- App shell có header/navigation placeholder và trạng thái loading, empty, error,
  offline/retry mẫu, nhưng không hiển thị dữ liệu/chức năng nghiệp vụ giả.
- Thêm metadata, responsive baseline và smoke/accessibility test tối thiểu.
- Web đọc API base URL từ typed public configuration; không đưa secret vào biến
  `NEXT_PUBLIC_*`.

**Hoàn thành khi:** app shell build production, chạy responsive trên viewport điện
thoại/desktop, keyboard navigation dùng được và không có accessibility violation
nghiêm trọng trong smoke test.

### S1-11 — One-command developer workflow

**Phụ thuộc:** S1-04, S1-07, S1-10.

Thực hiện:

- Tạo một lệnh root `dev` hoặc `dev:local` để:
  1. kiểm tra prerequisite và port;
  2. khởi động/đợi local infrastructure healthy;
  3. chạy backend local với workload cần thiết;
  4. chạy Next.js dev server;
  5. forward log có prefix dễ đọc và dừng child process sạch khi Ctrl+C.
- Không tự xóa volume, sửa Docker global config hoặc kill process ngoài project.
- Cho phép chạy riêng `dev:web`, `dev:api`, `dev:worker` và `infra:up` để debug.
- Cung cấp `verify:local` chạy quality gate không cần credential production.
- Cập nhật README với prerequisite Docker, setup lần đầu, URL/port và lỗi thường
  gặp trên Windows.

**Hoàn thành khi:** fresh clone có thể đưa infrastructure, API, worker và web lên
bằng một lệnh sau install; dừng lệnh không để process Dike treo.

### S1-12 — CI, security gate và nghiệm thu

**Phụ thuộc:** S1-03, S1-06, S1-07, S1-09, S1-10, S1-11.

Thực hiện:

- Mở rộng CI thành các job có cache nhưng không chia sẻ secret:
  - repository/frontend quality + build;
  - Maven unit/architecture test;
  - integration test với container;
  - OpenAPI/generated-client drift;
  - secret/dependency/security scan phù hợp.
- Pin GitHub Actions bằng commit SHA như Stage 0.
- Lưu test report khi fail nhưng không upload database volume, environment file,
  secret hoặc log chứa dữ liệu nhạy cảm.
- Chạy fresh-clone drill trên Windows và CI Linux.
- Thực hiện negative tests trong mục 8.2.
- Cập nhật trạng thái work item và ghi bằng chứng CI/commit vào mục 10 khi đóng
  stage.

**Hoàn thành khi:** acceptance gate cuối đạt và không còn waiver kỹ thuật chưa được
ghi bằng ADR/issue có owner.

## 6. Dependency graph và khả năng làm song song

```text
S1-00
  ├── S1-01 ───────────────┬── S1-09 ──┐
  │                        └── S1-10 ──┤
  ├── S1-02 ── S1-03                    │
  │       └── S1-08 ───────── S1-09    │
  └── S1-04 ── S1-05 ── S1-06         │
                       └── S1-07 ── S1-11
                                      │
                         tất cả ── S1-12
```

Sau S1-00, có thể chạy ba luồng song song:

- Frontend/workspace: S1-01 → S1-10.
- Backend architecture/API: S1-02 → S1-03 và S1-08.
- Infrastructure/data: S1-04 → S1-05 → S1-06 → S1-07.

S1-09 là điểm tích hợp backend–frontend. S1-11 và S1-12 chỉ làm khi các luồng nền
đã ổn định.

## 7. Ownership đề xuất cho đội bốn người

Owner cụ thể được gán trong GitHub Issue, không ghi cứng tên người vào tài liệu.

| Luồng                | Trách nhiệm chính                                      | Reviewer bắt buộc      |
| -------------------- | ------------------------------------------------------ | ---------------------- |
| Backend architecture | S1-02, S1-03, S1-08                                    | Data/infrastructure    |
| Data và worker       | S1-04, S1-05, S1-06, S1-07                             | Backend architecture   |
| Web và design system | S1-01, S1-10                                           | Contract/integration   |
| Contract và quality  | S1-09, S1-11, S1-12; hỗ trợ test cho các luồng còn lại | Ít nhất một luồng khác |

Người triển khai tự viết unit/integration test cho phần mình sở hữu. Luồng quality
không trở thành người duy nhất chịu trách nhiệm test.

## 8. Test plan

### 8.1. Kiểm thử dương

- Root frozen install, format, lint, typecheck, unit test và production build xanh.
- Maven root `verify` chạy Enforcer, Spotless, unit, Modulith và ArchUnit test.
- Compose khởi động MongoDB replica set, Redis và MinIO healthy từ trạng thái sạch.
- Backend `api` profile mở HTTP/health; `worker` profile không mở web server.
- Local combined profile hoạt động nhưng API/worker test vẫn chạy ở process riêng.
- Mongo transaction commit và rollback nhiều document đúng.
- Versioned index migration chạy lần đầu, bỏ qua an toàn lần sau và phát hiện
  checksum mismatch.
- Hai worker tranh cùng event chỉ một worker claim được.
- Handler lỗi được retry theo backoff; lease hết hạn được reclaim; handler chạy lặp
  không tạo effect trùng.
- OpenAPI và TypeScript client generation deterministic, không có Git diff sau lần
  sinh thứ hai.
- App shell render trên mobile/desktop, dùng keyboard được và health/readiness đạt.
- Fresh-clone drill bằng một lệnh local thành công.

### 8.2. Kiểm thử âm

- Java khác 21 hoặc Maven ngoài dải 3.9.x bị Enforcer từ chối.
- Thêm dependency cycle hoặc import internal package giữa module làm verification
  đỏ.
- Controller gọi repository hoặc domain import Spring Data làm ArchUnit đỏ.
- Chạy transaction test trên Mongo standalone bị từ chối, không âm thầm chuyển
  thành non-transactional.
- Cấu hình thiếu URI/bucket bắt buộc làm startup fail mà không log secret.
- Redis/MinIO/Mongo unavailable làm readiness phản ánh đúng; liveness không bị dùng
  sai để restart loop.
- Hai process cùng chạy migration không áp dụng index hai lần.
- Hai worker không hoàn thành cùng một outbox event; unknown payload version không
  bị đánh dấu `COMPLETED`.
- Sửa OpenAPI/generated client bằng tay hoặc quên regenerate làm `api:check` fail.
- Request validation lỗi luôn có error code và request ID; stack trace không xuất
  hiện trong response.
- Production build không chấp nhận seed local, demo credential hoặc cấu hình fake.
- Secret scan phát hiện fixture tổng hợp trong thư mục tạm; fixture không được
  commit.

### 8.3. Acceptance gate cuối

- Tồn tại đúng cấu trúc ở mục 3; không có mobile/Dart hoặc business feature vượt
  stage.
- Một lệnh local đưa Mongo replica set, Redis, MinIO, API, worker và web lên trạng
  thái sẵn sàng.
- `/actuator/health/liveness`, `/actuator/health/readiness` và app shell hoạt động.
- API và worker dùng cùng executable JAR/version; worker không mở HTTP.
- Modulith và ArchUnit verification xanh, có negative proof.
- Mongo transaction rollback, unique/index constraint và replica-set parity được
  chứng minh bằng Testcontainers.
- Outbox atomic write, claim concurrency, retry, lease reclaim và idempotent handler
  đều có integration test.
- OpenAPI là nguồn của generated TypeScript client; drift check xanh.
- Log/request ID/error envelope/health không rò thông tin nhạy cảm.
- `pnpm check` và Maven `verify` vẫn là root gate; CI xanh trên fresh clone.
- README, module docs, API artifact và runbook được cập nhật; không có secret, PII,
  dump hoặc generated artifact ngoài danh sách chủ đích.

## 9. Definition of Done cho từng work item

Một work item chỉ chuyển `Complete` khi:

- Code/config/tài liệu đúng phạm vi và có reviewer ngoài người triển khai.
- Test dương và âm liên quan đã chạy; không chỉ chứng minh happy path.
- Root checks và CI xanh, lockfile cập nhật, generated output không drift.
- Không thêm secret/PII, tag image nổi, dependency không pin hoặc dữ liệu prototype.
- Quyết định kiến trúc mới có ADR; thay đổi master plan được cập nhật cùng PR.
- Issue ghi commit/PR, log test hoặc CI URL làm bằng chứng.

## 10. Trạng thái thực thi

| Work item | Trạng thái          | Bằng chứng                                                          |
| --------- | ------------------- | ------------------------------------------------------------------- |
| S1-00     | Environment blocked | Matrix/toolchain locked; Docker client works but engine returns 500 |
| S1-01     | Complete            | Six workspaces; lint, typecheck, tests and production build pass    |
| S1-02     | Complete            | Spring Boot 4.1.1 executable JAR; Maven reactor passes              |
| S1-03     | Complete            | Modulith plus ArchUnit pass; three negative fixtures prove rules    |
| S1-04     | Implemented         | Pinned Compose validates; live health awaits recovered engine       |
| S1-05     | Implemented         | Typed config, S3 adapter, health and locked checksum migration      |
| S1-06     | Implemented         | Replica-set transaction/rollback/index IT compiles; CI run pending  |
| S1-07     | Implemented         | API/worker profiles, leased outbox, retry and idempotency tests     |
| S1-08     | Complete            | Error/request IDs, redaction, health and metrics foundation pass    |
| S1-09     | Complete            | Reviewed OpenAPI, backend parity test and deterministic TS client   |
| S1-10     | Complete            | Responsive shell/primitives build; semantic smoke tests pass        |
| S1-11     | Implemented         | Cross-platform local orchestrator; end-to-end awaits Docker         |
| S1-12     | Pending CI          | CI includes frontend, Maven IT, Compose and secret gates            |

Không đánh dấu `Complete` chỉ vì skeleton hoặc config đã tồn tại. Cột bằng chứng
phải được cập nhật khi thực thi.

Ghi chú nghiệm thu local ngày 06/10/2026: Docker Desktop client 28.4.0 hoạt động
nhưng Linux engine trả HTTP 500 và restart riêng Docker Desktop không hoàn tất.
Không reset/purge dữ liệu Docker. `pnpm check`, Maven `verify -DskipITs` (11 test),
OpenAPI drift check và `docker compose config --quiet` đều xanh. Full Maven
`verify`, fresh-start health và `pnpm dev` phải được CI hoặc máy có Docker Engine
khỏe xác minh trước khi đổi các mục `Implemented` thành `Complete`.

## 11. Failure handling và rollback

- Dependency/BOM không tương thích Spring Boot 4.1.x: dừng work item, ghi spike và
  tạo ADR nếu phải đổi baseline; không ép version để build tạm.
- Docker không khả dụng do quyền/config: giữ work item infrastructure ở `Blocked`,
  ghi lỗi tái hiện và sửa môi trường; không hạ Mongo thành standalone.
- Testcontainers không chạy ở CI: sửa runner/network/image pin; không thay bằng
  mock để đóng gate transaction/outbox.
- Migration lỗi: không tự sửa migration đã áp dụng. Tạo migration kế tiếp hoặc
  rollback có kiểm soát; checksum mismatch phải fail fast.
- OpenAPI generation khác Windows/Linux: chuẩn hóa line ending, locale, timezone và
  generator version; không bỏ drift check.
- Outbox poison event: chuyển `FAILED` sau retry limit, giữ payload/error đã redact
  để điều tra; replay chỉ qua thao tác có kiểm soát.
- Local reset chỉ được xóa named volume/container của Compose project Dike sau khi
  xác nhận target; không xóa Docker data toàn máy.
- Nếu feature nghiệp vụ vô tình đi vào Stage 1, tách/revert feature đó nhưng giữ
  foundation dùng chung đã được kiểm thử.

## 12. Bằng chứng cần lưu khi đóng Stage 1

Điền mục này trong lúc thực thi, không ghi trước kết quả:

- Commit/PR và CI run cuối của từng work item.
- Phiên bản dependency matrix và Docker image/digest đã dùng.
- Kết quả fresh-clone drill trên Windows và CI Linux.
- Log rút gọn của Modulith/ArchUnit negative proof.
- Test report transaction rollback, outbox concurrency/retry/idempotency.
- Kết quả OpenAPI/generated-client drift check.
- URL/ảnh chụp app shell và health chỉ nếu không chứa secret hoặc dữ liệu nhạy cảm.
- Ngoại lệ còn lại, owner, deadline và ADR/issue tương ứng; không có ngoại lệ ngầm.
