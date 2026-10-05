# STAGE 0 — Chuẩn hóa repository và phạm vi

Trạng thái: Implemented — acceptance pending  
Nguồn đặc tả: [PLAN_MASTER.md](PLAN_MASTER.md)  
Phạm vi: repository greenfield, governance, tooling baseline, CI, security, ADR và backlog

## 1. Mục tiêu

Stage 0 tạo một repository greenfield có thể kiểm tra lặp lại trên máy cá nhân và CI, khóa các quyết định kiến trúc nền, đồng thời thiết lập quy ước cộng tác cho bốn thành viên. Stage này không tạo ứng dụng nghiệp vụ hoặc hạ tầng runtime.

Kết quả cần đạt:

- `PLAN_MASTER.md` là nguồn đặc tả duy nhất; GitHub Issues chỉ là backlog vận hành.
- Repository private `hlqkhanh/Dike-v2`, nhánh mặc định `main`.
- `hlqkhanh` là owner/Admin; `chithong17`, `longfptaka3011`, `nguyenhat3105` có quyền Write.
- Baseline pnpm và Maven chạy được từ fresh clone.
- Hooks, CI, secret scan và dependency update được cấu hình theo quyền tối thiểu.
- Mười ADR nền được chấp thuận bởi cả bốn thành viên.
- Không khôi phục source, dữ liệu hoặc Git history của prototype cũ.

## 2. Quyết định đã khóa

### 2.1. Phạm vi sản phẩm và repository

- Đội thực tế có bốn thành viên.
- Web là React/Next.js; mobile hiện hành là Flutter/Dart.
- React Native/Expo chỉ tồn tại trong phụ lục lịch sử của master plan.
- Web và mobile dùng chung backend và OpenAPI contract; chúng không dùng chung UI.
- Client sinh mã được tách thành `packages/api-client-ts` và `packages/api-client-dart`.
- Repository private, không thêm `LICENSE`.
- Không tạo `PLAN.md` hoặc tài liệu kế hoạch thứ hai cạnh tranh với `PLAN_MASTER.md`.
- Thay đổi kiến trúc phải có ADR và cập nhật `PLAN_MASTER.md` trong cùng PR hoặc commit.
- Không tạo tag `prototype`, `legacy` hoặc release tag trong Stage 0.
- Không scaffold Spring Boot, Next.js, Flutter, database hoặc Docker service; các phần đó bắt đầu từ Stage 1.

### 2.2. Ownership và workflow

- Issue mới để unassigned, mang label `needs-owner`.
- Admin gán owner và reviewer trước khi issue chuyển sang thực hiện.
- Workstream dùng Role A/B/C/D; không mã hóa username cố định vào task kỹ thuật.
- Thành viên Write có thể push hoặc tự merge thay đổi rủi ro thấp vào `main` sau local checks.
- Auth, CI, security, dependency policy và ADR phải qua PR, ít nhất một review và CI xanh theo quy ước nhóm, dù ruleset không bắt buộc PR.
- Direct push làm CI đỏ phải được người push sửa hoặc revert ngay.

### 2.3. Toolchain

| Thành phần | Phiên bản/quy tắc                                                                          |
| ---------- | ------------------------------------------------------------------------------------------ |
| Node.js    | `24.21.0` LTS; chỉ chấp nhận `>=24.21.0 <25`                                               |
| pnpm       | `12.9.1`, quản lý qua Corepack và khóa trong `packageManager`                              |
| Java       | Java 21, không khóa vendor; CI dùng Eclipse Temurin                                        |
| Maven      | Maven Wrapper `3.9.10`                                                                     |
| Actions    | Quyền tối thiểu; action bên thứ ba pin bằng full commit SHA                                |
| Commit     | Conventional Commits: `feat`, `fix`, `docs`, `chore`, `test`, `ci`, `refactor`, `security` |

Máy nghiệm thu hiện phải được nâng từ Node 22 lên Node 24.21.0. Trên Windows, dùng Corepack hoặc executable `.cmd`; không yêu cầu thay đổi PowerShell execution policy toàn hệ thống.

## 3. Ngoài phạm vi

- Source Spring Boot, Next.js hoặc Flutter.
- MongoDB, Redis, MinIO và Docker Compose runtime.
- REST API, schema dữ liệu, event contract hoặc runtime service.
- Deployment credential và production environment.
- Khôi phục/migrate prototype, demo data hoặc Git history cũ.
- Gán lâu dài username cụ thể cho workstream A/B/C/D.

## 4. Work breakdown

Mỗi work item có owner và reviewer được gán trên GitHub Issue trước khi bắt đầu. Owner và reviewer phải là hai người khác nhau đối với thay đổi rủi ro cao.

### S0-00 — Đồng bộ nguồn sự thật

Deliverable:

- Sửa `PLAN_MASTER.md` thành đội bốn người và Flutter/Dart.
- Cấu trúc tương lai dùng `api-client-ts`, `api-client-dart`, `design-tokens`, `frontend-config`, `web-ui`.
- React Native/Expo chỉ xuất hiện trong phụ lục được gắn nhãn lịch sử.
- Liên kết từ Stage 0 trong master plan đến tài liệu này.
- Ghi quy tắc ADR + master plan trong cùng thay đổi kiến trúc.

Nghiệm thu:

- Không có quyết định hiện hành mâu thuẫn giữa Flutter/React Native hoặc ba/bốn thành viên.
- Không tồn tại tài liệu kế hoạch thứ hai cạnh tranh với `PLAN_MASTER.md`.

### S0-01 — Khởi tạo Git baseline

Deliverable:

- Chạy `git init -b main` và kiểm tra Git identity cá nhân.
- Thêm `.editorconfig`, `.gitattributes`, `.gitignore`.
- Thêm `.nvmrc`, `.node-version` với `24.21.0`; `.java-version` với `21`.
- LF mặc định, `.cmd`/`.bat` dùng CRLF; ảnh/font/archive là binary.
- Ignore Node, Java/Maven, Flutter, IDE, log, coverage, Docker volume, dump, upload/data và mọi `.env` trừ `.env.example`.

Không thực hiện:

- Không nhập lịch sử prototype.
- Không tạo orphan branch hoặc tag lịch sử.
- Không lưu email, token hoặc credential vào repository.

Chuỗi commit dự kiến:

1. `docs: establish greenfield baseline`
2. `chore: initialize repository tooling`
3. `ci: add quality and security checks`
4. `docs: record architecture decisions and backlog`

### S0-02 — Root pnpm workspace

Deliverable:

- `package.json` có `private: true`, engine Node và `packageManager` đã khóa.
- Scripts `setup:repo`, `format`, `format:check`, `lint:md`, `check`.
- `pnpm-workspace.yaml` nhận `apps/*`, `packages/*` dù workspace ứng dụng chưa tồn tại.
- Commit `pnpm-lock.yaml`.
- `minimumReleaseAge: 1440`, chặn exotic dependency mặc định và chỉ cho phép dependency lifecycle script đã review.
- Dev dependencies tối thiểu: Prettier, markdownlint-cli2, Commitlint conventional, lint-staged.
- Không thêm ESLint, TypeScript hoặc Next.js.

Kiểm tra chuẩn:

```powershell
corepack enable
corepack prepare pnpm@12.9.1 --activate
pnpm install --frozen-lockfile
pnpm check
```

### S0-03 — Maven baseline

Deliverable:

- Wrapper gồm `mvnw`, `mvnw.cmd`, `.mvn/wrapper/*`, phân phối Maven 3.9.10.
- Root `pom.xml`: `com.dike:dike-parent:0.0.1-SNAPSHOT`, packaging `pom`.
- Java release 21 và UTF-8.
- Maven Enforcer yêu cầu Java 21 và Maven 3.9.x.
- Phiên bản plugin được khóa trong `pluginManagement`.
- Spotless/static-check lifecycle sẵn sàng cho module backend Stage 1 kế thừa.
- Chưa có module `apps/backend` hoặc Spring dependency.

Nghiệm thu:

```powershell
.\mvnw.cmd -B -ntp verify
```

Lệnh phải chạy Enforcer và cấu hình validation thật, không phải script no-op.

### S0-04 — Git hooks và quy ước làm việc

Deliverable trong `.githooks/`:

- `pre-commit`: chạy lint-staged, chỉ format file Markdown/JSON/YAML được stage.
- `commit-msg`: kiểm tra Conventional Commit bằng Commitlint.
- `pre-push`: chạy `pnpm check` và Maven Wrapper `verify`.
- `pnpm setup:repo`: đặt `core.hooksPath=.githooks` nếu đang trong Git repository.
- `prepare` được phép cấu hình hook sau install khi `.git` tồn tại.

Quy ước nhánh khi dùng PR: `feat/*`, `fix/*`, `docs/*`, `chore/*`, `security/*`. `--no-verify` không được xem là đạt quality gate; CI là nguồn kiểm chứng cuối.

### S0-05 — Tài liệu repository

Tạo:

- `README.md`: mục tiêu, trạng thái greenfield, kiến trúc, prerequisite, bootstrap/check và liên kết tài liệu.
- `CONTRIBUTING.md`: branch/commit, review theo rủi ro, Definition of Done, dữ liệu tổng hợp.
- `SECURITY.md`: kênh báo riêng cho Admin, cấm báo secret/PII qua public issue, quy trình revoke/rotate.

Không thêm `LICENSE`, giấy tờ, dump, upload có PII hoặc token “demo” có khả năng dùng thật.

### S0-06 — Architecture Decision Records

ADR dùng template: Status, Date, Context, Decision, Alternatives, Consequences, Validation, Revisit triggers.

Tạo ở trạng thái `Accepted`:

1. `0000-greenfield-baseline.md`
2. `0001-spring-boot-modular-monolith.md`
3. `0002-java-21-and-maven.md`
4. `0003-mongodb-primary-store.md`
5. `0004-websocket-stomp.md`
6. `0005-mongodb-outbox-worker.md`
7. `0006-auth-and-session-model.md`
8. `0007-cloudflare-r2-object-storage.md`
9. `0008-deployment-topology.md`
10. `0009-flutter-mobile.md`

ADR chỉ được coi là ratified khi cả bốn thành viên xác nhận trong PR hoặc issue ratification. ADR `Accepted` không được chứa TODO kiến trúc mở.

### S0-07 — GitHub repository và quyền

Preflight:

1. `gh auth login -h github.com` cho `hlqkhanh` và `gh auth status`.
2. Kiểm tra `hlqkhanh/Dike-v2`.
3. Nếu chưa tồn tại, tạo private repository từ local.
4. Nếu tồn tại và rỗng, gắn `origin`.
5. Nếu có commit/file, dừng; không force-push hoặc ghi đè.

Thiết lập:

- Default branch `main`, visibility private.
- Bật Issues và Actions; tắt Wiki.
- Chỉ squash merge; tự xóa branch sau merge.
- Ruleset `main-safety`: chặn deletion và non-fast-forward/force push; không bắt buộc PR/status check; owner/Admin là bypass actor duy nhất.
- Mời `chithong17`, `longfptaka3011`, `nguyenhat3105` với quyền Write.
- Không cấp Admin bổ sung và chưa tạo `CODEOWNERS`.

### S0-08 — CI và security baseline

`.github/workflows/ci.yml`:

- Trigger push `main`, pull request và manual dispatch.
- Concurrency hủy run cũ cùng branch/PR.
- Mặc định `permissions: contents: read`.
- `repo-quality`: Node 24.21.0, pnpm 12.9.1, frozen install, `pnpm check`.
- `java-baseline`: Temurin 21, `./mvnw -B -ntp verify`.
- `secret-scan`: quét toàn Git history bằng Gitleaks hoặc tương đương.
- Không dùng `pull_request_target` hoặc deployment secret.
- Action bên thứ ba pin full SHA và có comment phiên bản/tag.

Dependabot theo dõi npm/pnpm root, Maven root và GitHub Actions theo lịch tuần; gom patch/minor development dependency. Security update không chờ lịch.

Tracked-file policy từ chối `.env`, private key, keystore, dump, upload/data; chỉ cho file example chứa placeholder. CI secret scan là bắt buộc kể cả khi GitHub secret scanning/push protection không có trên gói hiện tại.

### S0-09 — GitHub Issues backlog

Tạo milestone không due date cho `Stage 0` đến `Stage 17`.

Label chuẩn:

- Type: `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:test`, `type:security`.
- Area: `area:web`, `area:backend`, `area:mobile`, `area:infra`, `area:architecture`, `area:docs`.
- Priority: `priority:p0`, `priority:p1`, `priority:p2`, `priority:p3`.
- Flow: `needs-owner`, `blocked`.

Issue template có Context + link master plan, in/out of scope, dependency, acceptance criteria, verification, security/privacy, documentation, owner/reviewer.

Tạo umbrella issue cho Stage 0–17. Stage tương lai chỉ ghi mục tiêu và completion gate. Stage 0 được tách thành issue S0-00 đến S0-10; issue ban đầu unassigned và có `needs-owner`.

### S0-10 — Nghiệm thu và bàn giao

- Thực hiện fresh-clone drill trên Windows với đúng toolchain.
- Kiểm thử dương, âm và security fixture tạm thời.
- Xác nhận CI xanh, ruleset hoạt động, quyền collaborator đúng.
- Xác nhận ADR ratification và backlog đầy đủ.
- Ghi kết quả vào issue S0-10; không commit fixture secret.

## 5. Public interfaces sau Stage 0

Windows:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm check
.\mvnw.cmd -B -ntp verify
pnpm setup:repo
```

CI/Linux:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
./mvnw -B -ntp verify
```

Stage 0 không thêm REST API, database schema, event contract hoặc runtime service.

## 6. Definition of Done chung

- Working tree và history không chứa secret/PII.
- Lockfile cập nhật khi dependency đổi.
- `pnpm check` và Maven `verify` xanh.
- Tài liệu/ADR cập nhật khi quyết định thay đổi.
- CI xanh; direct push làm hỏng `main` được fix/revert ngay.
- Owner/reviewer và bằng chứng nghiệm thu được ghi trong issue.

## 7. Test plan

### 7.1. Kiểm thử dương

- Clone vào thư mục tạm sạch trên Windows.
- Dùng Node 24.21.0, pnpm 12.9.1, Java 21.
- Frozen install, `pnpm check` và `mvnw.cmd verify` thành công.
- CI đủ ba job và xanh trên `main`.
- Một collaborator Write clone và chạy được toàn bộ checks.
- Issues, milestone, label và template hiển thị đúng.
- Mười ADR có xác nhận của bốn thành viên.

### 7.2. Kiểm thử âm

- Commit message sai Conventional Commit bị hook từ chối.
- Markdown sai format bị `pnpm check` từ chối.
- Lockfile lệch khiến frozen install thất bại.
- Java khác 21 bị Enforcer từ chối.
- Fake secret trong working copy tạm bị scanner phát hiện; fixture không được commit.
- Tài khoản Write không thể force-push hoặc xóa `main`.
- Workflow chứa action không pin SHA bị review từ chối.

### 7.3. Acceptance gate cuối

- Master plan thống nhất đội bốn người và Flutter.
- Runbook này tồn tại và được master plan liên kết.
- Private repo tồn tại, `main` là default.
- Ba collaborator có Write; chỉ owner có Admin.
- Working tree sạch và không có artifact prototype.
- Không có license công khai, secret, PII, dump hoặc upload artifact.
- Fresh-clone drill và CI xanh.
- ADR được ratify và backlog Stage 0–17 đã tạo.
- Không có tag prototype/legacy/release.

## 8. Failure handling

- Remote có history: dừng và báo xung đột, không force-push.
- GitHub auth chưa khôi phục: hoàn tất local baseline nhưng Stage 0 vẫn chưa đạt.
- Secret từng được push: rotate/revoke trước, sau đó mới làm sạch history; xóa file không đủ.
- Docker config hiện lỗi quyền đọc là known issue phải xử lý trước Stage 1; không chặn Stage 0.
- Node 22 không đạt baseline; phải nâng lên Node 24.21.0 trước nghiệm thu.
- GitHub plan không hỗ trợ secret scanning/push protection: giữ CI secret scan bắt buộc và ghi rõ giới hạn.

## 9. Trạng thái thực thi

| Work item | Trạng thái                        | Bằng chứng                                                                                       |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| S0-00     | Complete                          | `PLAN_MASTER.md`, tài liệu này                                                                   |
| S0-01     | Complete                          | Git history greenfield trên `main`; không có tag                                                 |
| S0-02     | Complete                          | `package.json`, `pnpm-workspace.yaml`, frozen lockfile                                           |
| S0-03     | Complete                          | `pom.xml`, Maven Wrapper 3.9.10, Enforcer và Spotless xanh                                       |
| S0-04     | Complete                          | `.githooks/`; pre-push xanh; Commitlint negative test xanh                                       |
| S0-05     | Complete                          | README, CONTRIBUTING, SECURITY; không có LICENSE                                                 |
| S0-06     | Pending ratification              | Mười ADR Accepted đã tạo; còn cần xác nhận của bốn thành viên                                    |
| S0-07     | Partially complete                | Repo/settings/permissions hoàn tất; gói GitHub hiện tại không hỗ trợ ruleset cho private repo    |
| S0-08     | Complete with documented fallback | CI push/PR xanh; Gitleaks bắt buộc; GitHub-native secret scanning không được gói hiện tại hỗ trợ |
| S0-09     | Complete                          | 18 milestones; 29 issues unassigned có `needs-owner`; issue/PR template                          |
| S0-10     | Acceptance pending                | Fresh-clone drill xanh; còn các gate thủ công liệt kê bên dưới                                   |

Trạng thái trong bảng phải được cập nhật theo bằng chứng thực tế; không đánh dấu hoàn thành chỉ vì file cấu hình đã được tạo.

## 10. Bằng chứng thực thi ngày 2026-10-05

- Repository: <https://github.com/hlqkhanh/Dike-v2>, private, default branch `main`, Issues/Actions bật, Wiki tắt, squash-only và tự xóa branch sau merge.
- Quyền: `hlqkhanh` là Admin; `chithong17`, `longfptaka3011`, `nguyenhat3105` đều được GitHub API báo role `write`.
- Backlog: 18 milestone Stage 0–17; 18 umbrella issue và 11 issue S0-00–S0-10. Toàn bộ 29 issue ban đầu unassigned và có `needs-owner`.
- CI: [run trên main](https://github.com/hlqkhanh/Dike-v2/actions/runs/37262541863) xanh đủ `repo-quality`, `java-baseline`, `secret-scan`. Sáu Dependabot PR đầu tiên cũng xanh sau khi job Gitleaks được cấp riêng `pull-requests: read`.
- Fresh clone Windows chạy thành công với Node 24.21.0 portable đã xác minh checksum, pnpm 12.9.1, Java 21 và Maven Wrapper 3.9.10: frozen install, `pnpm check`, Enforcer và Spotless đều xanh.
- Git hooks được cài qua `core.hooksPath=.githooks`; pre-push chạy cả pnpm/Maven và Commitlint từ chối message không theo Conventional Commits.
- Negative secret test chạy bằng Gitleaks 8.24.3 đã xác minh checksum và phát hiện fixture AWS tổng hợp trong `.tmp/`; fixture được Git ignore và không được commit.
- Negative Java test chạy bằng JDK 24 có sẵn và xác nhận Maven Enforcer từ chối với yêu cầu `Dike requires Java 21`.
- Không có tag, `LICENSE`, source/runtime Stage 1, database dump, upload artifact hoặc file `.env` được track.

Các gate còn mở trước khi đánh dấu Stage 0 hoàn thành:

1. Bốn thành viên ratify mười ADR trong PR hoặc issue.
2. Một collaborator Write tự thực hiện fresh-clone drill và ghi bằng chứng vào S0-10.
3. Nâng Node system từ 22.20.0 lên 24.21.0 bằng quyền Administrator. MSI chính thức đã khớp SHA-256 nhưng lượt cài tự động hiện tại bị Windows từ chối với Error 1730; bản portable chỉ được dùng để kiểm chứng, không được coi là đã nâng system runtime.
4. Bật `main-safety` ruleset khi tài khoản có GitHub Pro hoặc tính năng tương đương cho private repo, sau đó kiểm thử tài khoản Write không thể xóa/force-push `main`.
