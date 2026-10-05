# 0010 — Stage 0 governance baseline

- Status: Accepted
- Date: 2026-10-05

## Context

Dike là repository private của nhóm bốn thành viên tin cậy. Các gate kỹ thuật của Stage 0 đã xanh, nhưng bốn điều kiện quy trình còn lại không phản ánh rủi ro kỹ thuật thực tế: đủ bốn người ratify mọi ADR, collaborator lặp lại fresh-clone drill, cài Node đúng phiên bản ở cấp hệ thống và ruleset chỉ có trên gói GitHub cao hơn.

Giữ các điều kiện này làm blocker sẽ trì hoãn Stage 1 mà không tăng đáng kể độ tin cậy. Nhóm vẫn cần bảo toàn CI, kiểm tra dependency, secret scan và khả năng tái lập toolchain.

## Decision

- Owner có quyền chấp thuận ADR baseline. Thành viên review bất đồng bộ và đề xuất ADR mới khi không đồng ý; không yêu cầu đủ bốn xác nhận để bắt đầu stage kế tiếp.
- Fresh-clone drill do owner thực hiện cùng CI sạch là đủ cho nghiệm thu. Collaborator lặp lại khi onboarding hoặc khi gặp khác biệt môi trường.
- Node 24.21.0 được khóa ở repository và CI. Local có thể dùng bản system-wide hoặc portable đã xác minh checksum; không bắt buộc quyền Administrator để thay runtime toàn hệ thống.
- Khi private repository chưa được gói GitHub hiện tại hỗ trợ ruleset, nhóm dùng biện pháp bù: chỉ owner có Admin, cấm force-push/xóa `main`, yêu cầu local checks trước direct push và sửa hoặc revert ngay nếu CI đỏ.
- Các ngoại lệ governance không miễn trừ `pnpm check`, Maven `verify`, CI, Gitleaks hoặc tracked-file policy.

## Alternatives

- Giữ Stage 0 mở đến khi đủ bốn xác nhận và một collaborator chạy lại toàn bộ kiểm thử: không chọn vì phụ thuộc lịch cá nhân, trong khi owner và CI đã kiểm chứng khả năng tái lập.
- Nâng GitHub Pro chỉ để bật ruleset: không chọn ở quy mô hiện tại; sẽ cân nhắc khi repository có thêm contributor hoặc yêu cầu tuân thủ.
- Bắt buộc cài Node system-wide: không chọn vì bản portable đúng phiên bản cung cấp cùng runtime mà không cần thay đổi máy ngoài phạm vi repository.

## Consequences

- Stage 0 có thể đóng và Stage 1 bắt đầu dựa trên bằng chứng kỹ thuật hiện có.
- Một phần bảo vệ nhánh dựa vào kỷ luật nhóm thay vì enforcement của GitHub.
- Review ADR không còn là barrier đồng thuận bốn người; bất đồng phải được ghi bằng issue hoặc ADR thay thế.
- Onboarding vẫn phải chạy các lệnh kiểm tra chuẩn, nhưng không làm mất hiệu lực nghiệm thu Stage 0.

## Validation

- CI trên `main` chạy xanh các job repository quality, Java baseline và secret scan.
- Fresh clone trên Windows chạy thành công bằng Node 24.21.0, pnpm 12.9.1, Java 21 và Maven Wrapper 3.9.10.
- Chỉ owner có Admin; ba collaborator có Write.
- `plan/STAGE_0.md` ghi rõ ngoại lệ, bằng chứng và trạng thái hoàn thành.

## Revisit triggers

- GitHub cung cấp ruleset cho private repository trên gói hiện tại.
- Nhóm tăng quy mô, có contributor không thuộc nhóm tin cậy hoặc cần compliance audit.
- Direct push gây sự cố lặp lại trên `main`.
- CI/local xuất hiện sai khác do cách phân phối Node.
