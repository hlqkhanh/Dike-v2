# ADR 0015 — Hoãn eKYC và suy ra quyền tài xế thử nghiệm

- Status: Accepted
- Date: 2026-10-07
- Scope: Local/test trong thời gian triển khai Stage 7–14

## Context

Stage 5 ban đầu yêu cầu eKYC, duyệt phương tiện và cấp quyền
`APPROVED_DRIVER`. Nhóm chưa sẵn sàng chọn nhà cung cấp, chính sách lưu giấy tờ,
retention và quy trình vận hành dữ liệu định danh. Tuy nhiên các stage lịch,
định tuyến, chuyến và booking cần một tài khoản tài xế để phát triển và kiểm thử.

Ghi trực tiếp `APPROVED_DRIVER` vào MongoDB hoặc tạo endpoint “duyệt nhanh” sẽ
làm dữ liệu giả trông giống phê duyệt thật, có nguy cơ lọt sang môi trường hosted.

## Decision

- Hoãn eKYC và quy trình cấp quyền tài xế thật. Không nhận giấy tờ người thật,
  không gọi eKYC provider và không tuyên bố Stage 5 đã hoàn thành.
- Trong `local` và `test`, khi
  `dike.identity.simulated-driver-approval-enabled=true`, mọi tài khoản `ACTIVE`
  đã có `VERIFIED_MEMBER` được suy ra thêm `APPROVED_DRIVER` ở lớp access policy.
- Quyền suy ra không được ghi vào `User.assignedRoles`, không có migration và
  không có API/admin action để biến nó thành phê duyệt thật.
- Session API trả `driverApprovalEvidence=SIMULATED`. UI và dữ liệu kiểm thử phải
  hiển thị “Tài xế thử nghiệm”, không dùng nhãn đã eKYC hoặc đã duyệt thật.
- `assignedRoles=APPROVED_DRIVER` chỉ biểu diễn quyết định thật của workflow Stage
  5 sau này và trả `driverApprovalEvidence=REAL`.
- Staging/production không suy ra quyền này và phải từ chối khởi động nếu cờ mô
  phỏng được bật. Tắt cờ làm mất quyền hiệu lực ngay lần kiểm tra tiếp theo.
- Stage 7–14 có thể phát triển với quyền mô phỏng, nhưng nghiệm thu production
  pilot vẫn bị chặn đến khi Stage 5 thật hoàn tất.

## Alternatives

- Gán role thật bằng script/seed: từ chối vì không phân biệt được dữ liệu giả và
  quyết định vận hành thật.
- Tạm bỏ kiểm tra `APPROVED_DRIVER`: từ chối vì tạo đường tắt authorization và
  khiến test không phản ánh policy production.
- Triển khai eKYC ngay: hoãn vì phụ thuộc pháp lý, nhà cung cấp và retention chưa
  được duyệt.

## Consequences

Nhóm có thể kiểm thử end-to-end luồng tài xế bằng người dùng đã xác minh OTP mà
không tạo trạng thái phê duyệt bền vững. Evidence phải đi cùng authority để UI,
test và audit phân biệt rõ. Staging/production không có tài xế được duyệt cho đến
khi workflow Stage 5 cấp role thật.

## Validation

- Unit test chứng minh verified local user nhận quyền `SIMULATED`, có thể tắt cờ
  và staging/production không nhận quyền.
- Startup test chứng minh hosted environment từ chối cờ mô phỏng.
- Kiểm tra MongoDB không có `APPROVED_DRIVER` được thêm bởi cơ chế này.
- API contract và UI không gọi `SIMULATED` là eKYC/approval thật.

## Revisit triggers

- Chọn eKYC provider và hoàn thành data-protection review.
- Xây admin workflow duyệt hồ sơ/phương tiện và audit.
- Chuẩn bị staging có tài khoản tài xế hoặc production pilot.
