# Backend modules

Đọc [Tổng quan kiến trúc hệ thống Dike](../system-architecture-overview.md) trước
nếu bạn mới tham gia dự án hoặc cần hiểu cách web, backend, mobile, MongoDB, Redis,
outbox và realtime phối hợp với nhau.

Backend là một Spring Boot modular monolith. API và worker dùng cùng source, domain
model, executable JAR và chu kỳ phát hành.

| Module      | Ownership                                                                   |
| ----------- | --------------------------------------------------------------------------- |
| `identity`  | Danh tính, session, OTP, profile/privacy, consent, file và account deletion |
| `community` | Community, membership, friendship, block và social policy                   |
| `planning`  | Lịch, travel intent, ride post, saved post, routing query và snapshot       |
| `ride`      | Trip, stop, proposal, booking, availability và contribution                 |
| `messaging` | Conversation, message, notification, read marker, realtime và presence      |
| `trust`     | Review, report, moderation, admin operation và audit                        |
| `shared`    | Clock, ID, error contract, outbox, object-storage port và observability     |

## Dependency rules

1. `api` gọi `application`; controller không gọi repository.
2. `domain` không phụ thuộc HTTP, MongoDB, Redis, object storage hoặc provider SDK.
3. `infrastructure` triển khai port do module sở hữu.
4. Module chỉ gọi public application API/named interface hoặc dùng domain event đã
   công bố của module khác.
5. Không đặt entity hoặc business service trong `shared`.
6. Spring Modulith và ArchUnit kiểm tra các ranh giới này trong Maven `verify`.

`shared::application` và `shared::outbox` là named interface. Module nghiệp vụ chỉ
dùng abstraction ở đây; AWS SDK, Mongo document, Redis key và object locator không
được rò vào domain hoặc API contract.

## Tài liệu theo feature

- [Stage 4 — Profile, privacy, consent và file](../stage-4-overview.md)
- [Stage 6 — Social relations và revocation](../adr/0014-social-relations-and-revocation.md)

Identity triển khai port `community.SocialAccounts` và dùng public policy/purge API
của community. Community không import nội bộ identity; dependency này không tạo
cycle. Khi thêm membership, giữ ownership trong community và không nhận membership
assertion từ client.
