# Stage 17 release readiness

Ngày audit: 09/10/2026  
Trạng thái tổng: **BLOCKED — chưa được mở production pilot**

`READY` yêu cầu bằng chứng môi trường thật. Cấu hình hoặc scaffold trong repository chỉ
được đánh dấu `IN_PROGRESS`.

| Gate                       | Trạng thái  | Bằng chứng hiện có                                           | Blocker/việc tiếp theo                                                    |
| -------------------------- | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| G17-01 Stage 16 DoD        | BLOCKED     | Expo foundation, lint/typecheck và Android/iOS bundle export | Hoàn thiện critical journey và E2E trên Android/iOS thật                  |
| G17-02 Mobile auth         | BLOCKED     | SecureStore/bearer transport foundation                      | Google native exchange và backend mobile session rotate/revoke chưa có    |
| G17-03 Push/deep link      | BLOCKED     | Expo Notifications/Router dependency                         | Backend device registration, FCM/APNs credential và delivery test chưa có |
| G17-04 Background location | BLOCKED     | Expo Location/TaskManager dependency                         | Active-booking lifecycle, stop paths và battery report chưa có            |
| G17-05 Driver approval     | BLOCKED     | Simulated local/test access; hosted guard                    | eKYC/real approval hoặc ADR pilot replacement chưa được duyệt             |
| G17-06 Production OTP      | BLOCKED     | OTP port/rate limit và hosted fake-provider guard            | Chưa có provider thật và staging delivery evidence                        |
| G17-07 Repository gates    | IN_PROGRESS | CI, Maven/Testcontainers, web checks, container build gate   | Chạy release-candidate gate và mobile real-device E2E                     |
| G17-08 Privacy/legal       | BLOCKED     | Consent/deletion implementation foundation                   | Privacy notice, retention/subprocessor/legal approval chưa có             |

## Repository implementation evidence

| Work item                     | Trạng thái       | Evidence                                                                                   |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| S17-00 readiness baseline     | COMPLETE         | File này và `plan/STAGE_17.md`                                                             |
| S17-01 environment baseline   | IN_PROGRESS      | Staging/production Spring profiles và Render staging blueprint; account creation cần owner |
| S17-02 backend image          | COMPLETE_IN_REPO | Multi-stage non-root `Dockerfile`; CI/release image checks                                 |
| S17-03 staging deployment     | BLOCKED_EXTERNAL | `infra/render.yaml` sẵn sàng; cần Render/Vercel/Atlas/Redis/R2 accounts và secrets         |
| S17-04 production guards      | COMPLETE_IN_REPO | Auth guard và hosted dependency/provider validator có unit test                            |
| S17-05 promotion/rollback     | IN_PROGRESS      | Release-candidate workflow, smoke script và release runbook; cần rehearsal thật            |
| S17-06 secret rotation        | BLOCKED_EXTERNAL | Cần provider inventory, owners và rotation drill                                           |
| S17-07 observability          | IN_PROGRESS      | Structured logging, Actuator/Micrometer foundation; dashboard/alert provider chưa cấu hình |
| S17-08 backup/restore         | BLOCKED_EXTERNAL | Restore runbook có sẵn; cần Atlas/R2 drill và report                                       |
| S17-09 performance/resilience | BLOCKED          | Chưa có staging-equivalent k6 report                                                       |
| S17-10 security               | IN_PROGRESS      | Existing CI secret scan/authorization tests; cần release threat review/report              |
| S17-11 privacy/operations     | IN_PROGRESS      | Incident/restore runbook; policy approval và game day chưa có                              |
| S17-12 mobile release         | BLOCKED          | Stage 16 native blockers và store credentials                                              |
| S17-13 pilot rehearsal        | BLOCKED          | Phụ thuộc S17-08–12                                                                        |
| S17-14 cohort rollout         | BLOCKED          | Chưa qua go/no-go                                                                          |
| S17-15 handover               | BLOCKED          | Chỉ thực hiện sau pilot                                                                    |
