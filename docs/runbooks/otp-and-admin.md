# OTP và bootstrap quyền quản trị

Runbook này dùng cho Stage 3 khi kiểm tra OTP giả ở local/test và khi bootstrap
quyền `ADMIN`. SMS thật đang được hoãn; không dùng bằng chứng fake để nghiệm thu
delivery production.

## 1. OTP local

Giữ các giá trị local trong `.env.local.example`: provider `fake`, send enabled,
hai HMAC secret chỉ dùng local và `REQUIRE_PHONE_OTP=false`. Chạy hệ thống bằng
`pnpm dev`, đăng nhập Google và gửi OTP trên `/onboarding/phone`.

Provider fake không ghi OTP vào log hoặc response API chung. Để lấy mã của
challenge hiện tại, mở DevTools Console trên origin `http://localhost:3000` và chạy:

```javascript
const challenge = new URL(location.href).searchParams.get("challenge");
await fetch(`/api/v1/auth/test/otp/${encodeURIComponent(challenge)}`).then(
  (r) => r.json(),
);
```

Route test chỉ được đăng ký khi `DIKE_OTP_PROVIDER=fake`, yêu cầu session đúng owner
và device, đồng thời từ chối địa chỉ không phải loopback. Guard khởi động khiến
staging/production không thể chạy provider fake.

Kiểm tra tối thiểu:

1. Gửi OTP, nhập sai một lần, sau đó nhập mã vừa đọc và xác nhận trạng thái
   `VERIFIED` với evidence `SIMULATED`.
2. Resend trước cooldown nhận `429` và countdown; sau cooldown mã cũ không dùng được.
3. Reload trang OTP chỉ đọc lại challenge, không tự gửi mã mới.
4. Hủy/đổi số làm challenge cũ mất hiệu lực; đổi số đã verify yêu cầu Google
   re-auth không quá 5 phút.
5. Không thấy mã/số đầy đủ trong backend log, URL, localStorage hoặc analytics.

## 2. Bootstrap ADMIN

Bootstrap mặc định tắt và dry-run. Chỉ dùng account ID nội bộ; không dùng email và
không truyền credential. Đặt biến môi trường ở runtime vận hành được kiểm soát:

```text
DIKE_ADMIN_BOOTSTRAP_ENABLED=true
DIKE_ADMIN_BOOTSTRAP_DRY_RUN=true
DIKE_ADMIN_BOOTSTRAP_ACCOUNT_ID=<account-id>
DIKE_ADMIN_BOOTSTRAP_OPERATOR=<operator-id>
DIKE_ADMIN_BOOTSTRAP_REASON=<ticket-or-reason>
```

Khởi động một instance và kiểm tra log `WOULD_ASSIGN`. Sau review, đổi dry-run thành
`false` và khởi động lại đúng một lần. Kết quả thành công là `ASSIGNED`; chạy lại
phải trả `ALREADY_ASSIGNED`. Assignment thật tăng `authorizationVersion` và ghi
event audit `identity.admin-role-assigned` trong cùng transaction.

Sau khi hoàn tất, tắt `DIKE_ADMIN_BOOTSTRAP_ENABLED`. Không tạo endpoint web cấp
role và không coi `ADMIN` là quyền bỏ qua owner/privacy policy.

## 3. Gate trước merge

Chạy `pnpm check` và `mvnw verify`. Gate hợp lệ phải có Docker Engine để MongoDB
replica-set/Testcontainers chạy không skip. Ghi commit SHA, số pass/fail/skip và
môi trường vào báo cáo CI. Khi SMS thật được nối lại, bổ sung contract test adapter,
sandbox delivery evidence và xác nhận không có secret/OTP trong log.
