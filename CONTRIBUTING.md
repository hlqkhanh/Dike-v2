# Contributing to Dike

## Nguyên tắc dữ liệu

- Chỉ dùng dữ liệu tổng hợp, có thể tái tạo trong local và test.
- Không commit secret, token, PII, giấy tờ thật, database dump hoặc upload của người dùng.
- Không khôi phục source, dữ liệu hoặc Git history của prototype cũ.

## Thiết lập repository

Sau khi clone và cài đúng toolchain:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm setup:repo
pnpm check
.\mvnw.cmd -B -ntp verify
```

`pnpm setup:repo` đặt `core.hooksPath=.githooks`. Git hooks hỗ trợ phản hồi sớm; CI vẫn là quality gate cuối.

## Nhánh và commit

`main` là nhánh mặc định. Khi cần PR, dùng một trong các prefix:

- `feat/*`
- `fix/*`
- `docs/*`
- `chore/*`
- `security/*`

Commit phải theo Conventional Commits với type: `feat`, `fix`, `docs`, `chore`, `test`, `ci`, `refactor` hoặc `security`.

## Chính sách review theo rủi ro

Thay đổi rủi ro thấp có thể push trực tiếp vào `main` sau khi local checks xanh. Auth, CI, security, dependency policy và ADR phải qua PR, có ít nhất một reviewer và CI xanh theo quy ước nhóm. Direct push làm CI đỏ phải được sửa hoặc revert ngay.

Không force-push hoặc xóa `main`. Không xem `--no-verify` là bằng chứng đạt quality gate.

## Issue workflow

- Issue mới để unassigned và có label `needs-owner`.
- Admin gán owner và reviewer trước khi bắt đầu.
- Issue phải nêu in/out of scope, dependency, acceptance criteria, verification, security/privacy và documentation impact.
- Thay đổi requirement phải cập nhật `plan/PLAN_MASTER.md`, không chỉ sửa issue.

## Definition of Done

- Không có secret/PII trong working tree hoặc history.
- Lockfile cập nhật khi dependency thay đổi.
- `pnpm check` và Maven `verify` xanh.
- Test phù hợp với rủi ro đã được thêm/chạy.
- Tài liệu, ADR và master plan được cập nhật khi quyết định thay đổi.
- CI xanh và bằng chứng nghiệm thu được liên kết vào issue/PR.
