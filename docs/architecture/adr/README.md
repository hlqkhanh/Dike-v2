# Architecture Decision Records

ADR trong thư mục này ghi các quyết định kiến trúc và governance hiện hành. `Accepted` mô tả quyết định đã được owner chấp thuận; cả nhóm có thể review bất đồng bộ và đề xuất ADR mới để thay đổi quyết định.

## Quy tắc

- Dùng số thứ tự bốn chữ số và tên kebab-case.
- Không sửa ngược nội dung quyết định đã được ratify; tạo ADR mới để supersede.
- Thay đổi kiến trúc phải cập nhật `plan/PLAN_MASTER.md` trong cùng PR hoặc commit.
- ADR Accepted không chứa TODO kiến trúc mở.

## Danh mục

- [0000 — Greenfield baseline](0000-greenfield-baseline.md)
- [0001 — Spring Boot Modular Monolith](0001-spring-boot-modular-monolith.md)
- [0002 — Java 21 and Maven](0002-java-21-and-maven.md)
- [0003 — MongoDB primary store](0003-mongodb-primary-store.md)
- [0004 — WebSocket/STOMP](0004-websocket-stomp.md)
- [0005 — MongoDB outbox worker](0005-mongodb-outbox-worker.md)
- [0006 — Auth and session model](0006-auth-and-session-model.md)
- [0007 — Cloudflare R2 object storage](0007-cloudflare-r2-object-storage.md)
- [0008 — Deployment topology](0008-deployment-topology.md)
- [0009 — Flutter mobile](0009-flutter-mobile.md)
- [0010 — Stage 0 governance baseline](0010-stage-0-governance-baseline.md)
- [0011 — Web same-origin authentication proxy](0011-web-same-origin-auth-proxy.md)
- [0012 — OTP verification and account authority](0012-otp-verification-and-account-authority.md)
- [0013 — Profile, privacy, consent and file lifecycle](0013-profile-privacy-consent-and-file-lifecycle.md)
- [0014 — Social relations and revocation](0014-social-relations-and-revocation.md)
- [0015 — Deferred eKYC and simulated driver approval](0015-deferred-ekyc-and-simulated-driver-approval.md)
- [0016 — Realtime messaging and outbox fan-out](0016-realtime-messaging-and-outbox-fanout.md)
- [0017 — Location privacy and availability](0017-location-privacy-and-availability.md)
- [0018 — Trip settlement, reviews and moderation](0018-trip-settlement-reviews-and-moderation.md)
- [0019 — Local simulated full access](0019-local-simulated-full-access.md)
