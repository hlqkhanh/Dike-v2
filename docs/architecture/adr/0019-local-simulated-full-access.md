# ADR 0019 — Local simulated full access

- **Status:** Accepted
- **Date:** 2026-10-08
- **Supersedes:** Phần cấp quyền mô phỏng của ADR 0015

## Context

OTP, eKYC và duyệt phương tiện thật chưa được triển khai, trong khi nhóm cần kiểm thử xuyên suốt luồng hành khách và tài xế. Việc sửa trực tiếp trạng thái điện thoại hoặc lưu role giả sẽ làm dữ liệu thử nghiệm trông giống bằng chứng production và có nguy cơ mở nhầm quyền trên môi trường hosted.

## Decision

- Chỉ `local` và `test` được bật `dike.identity.simulated-full-access-enabled`.
- User `ACTIVE`, đã chấp nhận tài liệu bắt buộc và đã gửi số điện thoại hợp lệ được tính động các authority `MEMBER`, `VERIFIED_MEMBER`, `APPROVED_DRIVER`.
- MongoDB vẫn lưu `phoneStatus=UNVERIFIED`; không lưu role, eKYC record hoặc vehicle approval giả.
- API trả `accessMode=SIMULATED`, `verificationEvidence=SIMULATED` và `driverApprovalEvidence=SIMULATED` để client gắn nhãn rõ ràng.
- Ride module cung cấp hai ID xe tổng hợp `simulated:motorcycle` và `simulated:car`; chúng không đại diện cho hồ sơ xe thật.
- Staging/production fail fast nếu simulation được bật và từ chối ID xe tổng hợp.

## Alternatives

- Seed role/verification vào MongoDB: bị loại vì làm sai nguồn sự thật và khó thu hồi.
- Xây OTP/eKYC/vehicle approval ngay: bị loại vì các tích hợp này đã được hoãn.
- Chỉ mock frontend: bị loại vì không kiểm thử được authorization và nghiệp vụ backend.

## Consequences

- Nhóm có thể chạy E2E đầy đủ mà không thu thập giấy tờ hoặc số điện thoại thật.
- UI phải luôn dùng nhãn “Tài xế thử nghiệm” và “Số điện thoại chưa xác minh”.
- Tắt flag thu hồi quyền ở request tiếp theo mà không cần migration.
- Quyền moderator/admin không bao giờ phát sinh từ simulation.

## Validation

- Unit test kiểm tra quyền động, consent, account lock và hosted guard.
- Contract/integration test kiểm tra xe mẫu, capacity và namespace.
- E2E kiểm tra Google giả lập → consent → phone → chuyến thử nghiệm.

## Revisit triggers

ADR này phải được thay thế và cơ chế simulation phải được gỡ trước production pilot khi OTP, eKYC và duyệt phương tiện thật hoạt động.
