# Google OAuth smoke test

Runbook này dùng để nghiệm thu thủ công Google OAuth thật cho Stage 2. Chỉ dùng OAuth
client dành riêng cho development; không ghi client secret, email, cookie hoặc token
vào issue, ảnh chụp hay repository.

## 1. Cấu hình Google Cloud

1. Tạo OAuth client loại **Web application** trong Google Cloud Console.
2. Khai báo authorized redirect URI chính xác:
   `http://localhost:3000/api/v1/auth/callback/google`.
3. Nếu consent screen đang ở chế độ Testing, thêm tài khoản thử nghiệm vào danh sách
   test users.
4. Đặt `DIKE_GOOGLE_CLIENT_ID` và `DIKE_GOOGLE_CLIENT_SECRET` trong môi trường local.
   Không thêm giá trị thật vào `.env.local.example`.

## 2. Chạy hệ thống

```powershell
pnpm infra:up
pnpm dev
```

Mở `http://localhost:3000/login`, chọn **Tiếp tục với Google** và hoàn thành consent.

## 3. Checklist nghiệm thu

- Callback quay về `http://localhost:3000/auth/complete`, không lộ URL nội bộ của
  backend.
- User mới được chuyển tới `/onboarding/phone`.
- Reload trang vẫn đăng nhập; DevTools chỉ thấy cookie session `HttpOnly`, không thấy
  Google token trong Local Storage hoặc Session Storage.
- Nhập số Việt Nam hợp lệ tạo trạng thái `UNVERIFIED`.
- `/account/sessions` hiển thị thiết bị hiện tại; logout và logout-all vô hiệu phiên.
- Log không chứa authorization code, ID/access token, cookie, email hoặc số điện thoại
  đầy đủ.

Ghi kết quả vào issue nghiệm thu bằng trạng thái pass/fail, ngày chạy, commit SHA và
môi trường. Không đính kèm dữ liệu nhận dạng hoặc credential.

## 4. Lỗi thường gặp

- `redirect_uri_mismatch`: URI trong Google Console phải khớp từng ký tự với URI ở
  mục 1.
- `OIDC_LOGIN_FAILED`: kiểm tra client ID/secret, consent screen và đồng hồ hệ thống.
- `ORIGIN_NOT_ALLOWED`: `DIKE_AUTH_ALLOWED_ORIGINS` phải chứa chính xác
  `http://localhost:3000`.
- Không có session sau callback: kiểm tra Redis và bảo đảm browser bắt đầu luồng từ
  Next.js origin, không gọi trực tiếp cổng backend.
