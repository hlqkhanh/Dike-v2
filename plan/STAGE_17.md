# Stage 17 — Production hardening và production pilot

Ngày lập kế hoạch: 09/10/2026  
Trạng thái: In progress — production pilot đang bị chặn bởi readiness gates  
Phụ thuộc: Stage 0–16, đặc biệt mobile auth/push/location/device E2E của Stage 16

Trạng thái bằng chứng và blocker hiện tại được theo dõi tại
[STAGE_17_READINESS.md](STAGE_17_READINESS.md).

## 1. Mục tiêu

Đưa cùng một phiên bản Dike đã được nghiệm thu từ staging lên production một cách có
kiểm soát, quan sát được và có thể rollback. Stage này hoàn thiện hạ tầng, bảo mật,
khôi phục dữ liệu, quy trình vận hành, mobile store release và rollout pilot theo đợt
tối đa khoảng 500 người.

Stage 17 không dùng deployment thành công làm bằng chứng sản phẩm đã sẵn sàng. Chỉ mở
pilot khi các gate nghiệp vụ, bảo mật, dữ liệu, mobile và vận hành đều có bằng chứng.

## 2. Phạm vi

Trong phạm vi:

- Staging và production tách biệt cho Vercel, Render, MongoDB Atlas, Redis-compatible
  store, Cloudflare R2 và provider bên ngoài.
- Một backend image bất biến chạy cùng version cho workload `api` và `worker`.
- CI/CD có promote theo artifact, approval production, migration/index gate, smoke
  test, rollback và audit trail.
- Custom domain, TLS, WSS, CORS/origin allowlist và production startup guards.
- OTP/provider thật, secret inventory và rotation drill.
- Log, metric, trace, dashboard, alert và on-call/incident workflow.
- Backup/PITR, restore drill và kiểm tra tính toàn vẹn dữ liệu.
- Load, resilience, security, privacy và retention verification.
- EAS production signing, store metadata/submission và mobile staged rollout.
- Pilot theo cohort: internal, 20, 50–100 và tối đa 500 người.

Ngoài phạm vi:

- Microservice, Kubernetes, multi-region active-active và autoscaling phức tạp.
- Ví, thu hộ, hoàn tiền hoặc đối soát ngân hàng.
- Mở công khai không giới hạn hoặc marketing launch.
- Tính năng nghiệp vụ mới không cần thiết để đóng blocker pilot.
- Cam kết SLO thương mại 24/7; pilot vẫn phải có SLI, alert và giờ hỗ trợ rõ ràng.

## 3. Gate đầu vào

| Gate   | Điều kiện                                  | Bằng chứng bắt buộc                                                                                                           |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| G17-01 | Stage 16 đạt Definition of Done thực tế    | Android/iOS critical E2E trên thiết bị thật; không chỉ Expo bundle export                                                     |
| G17-02 | Mobile auth hoàn chỉnh                     | Google native exchange, secure session rotate/revoke/logout và threat model đã test                                           |
| G17-03 | Push và deep link hoàn chỉnh               | FCM/APNs sandbox, token rotation, logout/multi-device, payload redaction đạt                                                  |
| G17-04 | Background location an toàn                | Chỉ active booking có consent; mọi exit path dừng task; battery report Android/iOS                                            |
| G17-05 | Stage 5 production blocker được giải quyết | eKYC/driver approval thật hoặc owner có quyết định pilot hợp lệ thay thế bằng ADR; không bật simulated driver trên hosted env |
| G17-06 | OTP production sẵn sàng                    | Provider thật, rate limit, delivery monitoring và `REQUIRE_PHONE_OTP=true` được test staging                                  |
| G17-07 | Toàn repo xanh từ checkout sạch            | `pnpm check`, `pnpm api:check`, Maven `verify`, web/mobile E2E và security scans                                              |
| G17-08 | Không có blocker dữ liệu/pháp lý           | Privacy notice, consent, retention, deletion và danh sách subprocessor được duyệt                                             |

Nếu một gate chưa đạt, nhóm được phép dựng hạ tầng staging và runbook nhưng không được
submit production store build, nhập dữ liệu thật hoặc mở cohort bên ngoài nội bộ.

## 4. Kiến trúc phát hành mục tiêu

```text
Web commit ── Vercel preview ── staging ── production
                                      │
Backend commit ── image digest ───────┼── Render API
                                      ├── Render Worker
                                      └── Render Cron/one-shot migration

Mobile commit ── EAS build ID ── internal/preview ── store candidate ── staged rollout

Data: MongoDB Atlas + Redis-compatible store + Cloudflare R2
Telemetry: structured logs + metrics/traces/errors + alert routing
```

Nguyên tắc:

- API và worker dùng cùng image digest, configuration chỉ khác theo workload.
- Build một lần, promote cùng artifact; không rebuild riêng khi lên production.
- Migration/index job chạy tương thích ngược trước traffic switch.
- Web/mobile cũ và mới cùng hoạt động trong compatibility window đã công bố.
- Secret chỉ tồn tại trong provider secret store; log và artifact không chứa secret/PII.

## 5. Work breakdown

| ID     | Hạng mục                         | Phụ thuộc            | Tiêu chí hoàn thành                                                                    |
| ------ | -------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| S17-00 | Preflight và blocker register    | G17-01–08 audit      | Có bảng owner/deadline/evidence; mọi blocker phát hành được đánh dấu rõ                |
| S17-01 | Environment và account baseline  | S17-00               | Dev/staging/prod tách project, credential, bucket, database và quota                   |
| S17-02 | Backend image và workload parity | S17-01               | API/worker cùng digest; SBOM, provenance, non-root, healthcheck đạt                    |
| S17-03 | Staging deployment               | S17-02               | Vercel/Render/Atlas/Redis/R2 hoạt động qua domain staging, TLS/WSS đạt                 |
| S17-04 | Production configuration guards  | S17-03               | Fake/demo provider làm startup fail; CORS/origin/secure cookie/OTP guard test đạt      |
| S17-05 | CI/CD promotion và rollback      | S17-03–04            | Staging auto-deploy, production approval, smoke test và rollback rehearsal đạt         |
| S17-06 | Secret management và rotation    | S17-01               | Inventory có owner/expiry; rotate Google, OTP, R2, DB, Redis, push không downtime      |
| S17-07 | Observability                    | S17-03               | Dashboard/alert cho HTTP, socket, outbox, worker, DB, provider và mobile delivery      |
| S17-08 | Backup, PITR và restore drill    | S17-01               | Restore sang isolated environment trong RTO/RPO; kiểm tra record/object/session policy |
| S17-09 | Performance và resilience        | S17-03, S17-07       | k6 pilot workload đạt; dependency failure/degraded mode và recovery được ghi nhận      |
| S17-10 | Security hardening               | S17-04–06            | Threat model, IDOR/STOMP/upload/session/rate-limit review; không còn critical/high mở  |
| S17-11 | Privacy, retention và operations | S17-07–08            | Chính sách, deletion/export, incident/support/on-call runbook được diễn tập            |
| S17-12 | Mobile production release        | G17-01–04, S17-05–07 | Signed Android/iOS candidates, store disclosure, review và rollback/kill-switch đạt    |
| S17-13 | Pilot rehearsal                  | S17-08–12            | E2E production-like, restore, rollback, incident game day và go/no-go review đạt       |
| S17-14 | Cohort rollout                   | S17-13               | Internal → 20 → 50–100 → 500 theo gate; metric và feedback được theo dõi               |
| S17-15 | Handover và closure              | S17-14               | Báo cáo pilot, known issues, ownership, cost/quota và backlog hậu pilot hoàn chỉnh     |

## 6. Thứ tự triển khai đề xuất

### PR 17.1 — Readiness baseline

- S17-00 và ma trận gate Stage 16/Stage 5.
- ADR bổ sung nếu provider, topology, telemetry hoặc release policy thay đổi.
- Environment matrix, domain naming, resource ownership và cost budget.

Không che blocker bằng cách đánh dấu Stage 16 hoàn thành theo scaffold. Mobile native auth,
push, background location và real-device E2E phải có artifact/báo cáo tương ứng.

### PR 17.2 — Reproducible deployment

- S17-01–04.
- Container hardening, immutable version metadata và API/worker parity check.
- Staging domain, TLS/WSS, health/readiness và production startup guards.

### PR 17.3 — Delivery safety

- S17-05–06.
- CI/CD environment protection, smoke test, rollback và secret rotation.
- Chứng minh rollback không phá compatibility với web/mobile version trước.

### PR 17.4 — Observe and recover

- S17-07–08.
- Dashboard, alert routing, log redaction, PITR và isolated restore drill.

### PR 17.5 — Non-functional acceptance

- S17-09–11.
- Load/resilience, security review, privacy/retention và incident game day.

### PR 17.6 — Mobile stores

- S17-12.
- EAS production profiles, signing ownership, store listing/privacy disclosure,
  internal testing và phased-release procedure.

### PR 17.7 — Pilot rollout

- S17-13–15.
- Go/no-go checklist, cohort enrollment, support loop, daily review và closure report.

## 7. CI/CD và deployment gates

Mỗi release candidate phải ghi lại:

- Git commit, backend image digest, Vercel deployment ID và EAS build ID/version.
- OpenAPI compatibility result và minimum supported mobile version.
- Database migration/index plan, estimated duration và rollback/forward-fix strategy.
- Dependency, secret, container và CodeQL scan result.
- Unit, integration, E2E, smoke và load-test report liên quan.
- Người phê duyệt production và timestamp promote/rollback.

Pipeline tối thiểu:

1. Validate repository, contract và tests.
2. Build image/artifacts một lần; sinh SBOM và ký/provenance nếu provider hỗ trợ.
3. Deploy staging bằng artifact đó.
4. Chạy migration/index check, API/worker parity, smoke và synthetic critical journey.
5. Manual production approval sau khi gate report xanh.
6. Deploy worker/API theo thứ tự tương thích, rồi web; mobile phát hành theo phased rollout.
7. Chạy post-deploy smoke, theo dõi canary window và tự động/thủ công rollback theo ngưỡng.

Không dùng `--no-verify`, bỏ security scan hoặc tắt test để phát hành.

## 8. Observability và alert

Dashboard tối thiểu:

- HTTP request rate, p50/p95/p99 latency, 4xx/5xx và saturation.
- Mongo latency/transaction retry/connection pool; Redis latency/error/eviction.
- Outbox oldest age, backlog, retry/dead-letter và worker heartbeat.
- WebSocket active connection, connect/auth/subscription failure và disconnect rate.
- OTP delivery success/latency, Google auth failure, R2/Goong quota/error.
- Push registration/delivery/open failure theo platform/app version, không chứa token.
- Mobile crash-free session, app version adoption và background-location failure count.

Alert phải có severity, owner, runbook link, dedupe/cooldown và test notification. PII,
token, OTP, message body, exact location và private object key không được xuất hiện trong
log, trace, crash report hoặc alert.

## 9. Backup và disaster recovery

- Chốt RPO/RTO pilot và mapping theo MongoDB, R2, Redis/session và configuration.
- Bật Atlas backup/PITR phù hợp; versioning/lifecycle cho object storage nếu được chọn.
- Redis không là nguồn dữ liệu nghiệp vụ duy nhất; mất Redis phải degrade an toàn.
- Restore sang project/network cô lập, không ghi đè production.
- Kiểm tra user, booking, outbox, review, audit và object reference sau restore.
- Ghi thời gian thực tế, dữ liệu mất tối đa, bước DNS/config và quyết định resume/rollback.

## 10. Load và resilience acceptance

Kịch bản tối thiểu:

- 100 WebSocket connection duy trì đồng thời, reconnect có jitter và authorize lại.
- 20 request đồng thời tranh chỗ cuối: chỉ một booking hợp lệ, không âm capacity.
- Feed/search trên dataset pilot; p95 mục tiêu dưới 2 giây như Stage 9.
- Chat/outbox burst, worker restart và duplicate delivery không tạo side effect trùng.
- Redis restart, Mongo transient error, Goong/R2/OTP timeout và push provider degraded.
- Mobile chuyển Wi-Fi/4G, offline/reconnect, app restart và OS background kill.

Ngưỡng chi tiết phải được baseline trên staging tương đương production và ghi trong
report; không tự đặt SLO không đo được.

## 11. Security và privacy acceptance

- Rà soát Google/OIDC, mobile token exchange, session fixation/rotation/revocation.
- CSRF/origin/cookie trên web; bearer credential/secure storage trên mobile.
- IDOR theo profile, post, trip, booking, chat, review, report và private file.
- STOMP ticket one-time, destination authorization và reconnect/revoke.
- Upload MIME/size/ownership, signed URL TTL và object cleanup.
- Rate limit login, OTP, search, invitation, proposal, chat, upload và location.
- Secret rotation, least privilege, production access audit và break-glass procedure.
- Consent, data minimization, retention, account deletion/export và incident notice.

Critical/high finding chặn rollout. Medium phải có owner, deadline và risk acceptance
được ghi lại trước go-live.

## 12. Mobile production release

- Tách Google OAuth client, FCM/APNs credential và EAS environment theo staging/prod.
- Quyền location/notification và mô tả store khớp hành vi thực tế.
- Hoàn thiện privacy nutrition/data safety form từ data inventory đã duyệt.
- Build reproducible theo commit; version/build number tăng đơn điệu.
- Internal track/TestFlight trước; sau đó phased rollout có crash/auth/push guardrail.
- Server-side kill switch cho push, background location và mutation mobile rủi ro.
- Minimum supported version chỉ được nâng sau compatibility window và thông báo.

## 13. Pilot rollout và go/no-go

| Cohort       | Thời gian quan sát tối thiểu | Điều kiện mở cohort tiếp theo                                             |
| ------------ | ---------------------------- | ------------------------------------------------------------------------- |
| Internal     | 3 ngày sử dụng nghiệp vụ     | Không critical/high; alert/runbook/rollback hoạt động                     |
| 20 người     | 7 ngày                       | Critical journey ổn định; support xử lý được; không incident dữ liệu      |
| 50–100 người | 14 ngày                      | Error/latency/capacity trong guardrail; restore và rotation còn hiệu lực  |
| Tối đa 500   | Theo quyết định owner        | Security/privacy/legal gate còn đạt; chi phí/quota và on-call đủ khả năng |

Go/no-go review phải có đại diện product, backend, web/mobile và operations/security.
No-go nếu có giả mạo danh tính, vượt chỗ, lộ dữ liệu/vị trí, không rollback được, backup
không restore được, fake provider còn bật hoặc không có người chịu trách nhiệm incident.

## 14. Rollback và incident

- Rollback web/backend theo artifact đã biết tốt; không rebuild tại thời điểm incident.
- Migration phải expand/contract; ưu tiên forward fix nếu rollback schema không an toàn.
- Mobile không thể thu hồi tức thời nên dùng compatibility window và kill switch server.
- Severity matrix quy định ai chỉ huy, kênh liên lạc, thời gian acknowledge/escalate.
- Sau incident: bảo toàn evidence, thông báo theo chính sách, postmortem không đổ lỗi và
  theo dõi corrective action đến khi đóng.

## 15. Definition of Done

- Tất cả G17-01–08 và S17-00–15 có bằng chứng, owner xác nhận.
- Staging → production promote cùng artifact; API/worker cùng image digest.
- Production guards, custom domain, HTTPS/WSS, OTP và provider thật hoạt động.
- Smoke, rollback, secret rotation, incident và restore drill đã diễn tập thành công.
- Unit/integration/E2E/security/load gates xanh; không còn critical/high finding.
- Dashboard/alert/runbook và support ownership hoạt động trong pilot.
- Android/iOS store candidate được ký, review/disclosure đúng và rollout kiểm soát.
- Pilot đi qua các cohort mà không có sự cố chặn; có closure report và backlog hậu pilot.
