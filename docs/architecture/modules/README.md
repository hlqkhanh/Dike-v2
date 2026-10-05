# Backend modules

Backend là một Spring Boot modular monolith. API và worker dùng cùng source, domain
model, executable JAR và chu kỳ phát hành.

| Module      | Ownership                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| `identity`  | Danh tính, session, OTP, hồ sơ, xác minh và phương tiện                    |
| `community` | Community, membership, friendship, block và social policy                  |
| `planning`  | Lịch, travel intent, ride post, saved post, routing query và snapshot      |
| `ride`      | Trip, stop, proposal, booking, availability và contribution                |
| `messaging` | Conversation, message, notification, read marker, realtime và presence     |
| `trust`     | Review, report, moderation, admin operation và audit                       |
| `shared`    | Clock, ID, error contract, outbox, configuration và observability kỹ thuật |

## Dependency rules

1. `api` gọi `application`; controller không gọi repository.
2. `domain` không phụ thuộc HTTP, MongoDB, Redis, object storage hoặc provider SDK.
3. `infrastructure` triển khai port do module sở hữu.
4. Module chỉ gọi public application API/named interface hoặc dùng domain event đã
   công bố của module khác.
5. Không đặt entity hoặc business service trong `shared`.
6. Spring Modulith và ArchUnit kiểm tra các ranh giới này trong Maven `verify`.
