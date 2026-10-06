# Web authentication qua same-origin proxy

Trạng thái: Accepted
Ngày quyết định: 06/10/2026
ADR: [0011 — Web same-origin authentication proxy](../adr/0011-web-same-origin-auth-proxy.md)

## 1. Mục tiêu

Web Dike được triển khai trên Vercel, còn Spring Boot API được triển khai trên
Render. Tài liệu này quy định cách trình duyệt truy cập API và thực hiện Google
OAuth mà không phụ thuộc third-party cookie.

Quyết định cốt lõi:

```text
Browser -> Next.js/Vercel /api/* -> Spring Boot/Render
```

Next.js chỉ reverse proxy HTTP. Spring Boot vẫn là backend duy nhất sở hữu OAuth,
session, user, authorization và mọi nghiệp vụ.

## 2. Vấn đề cần giải quyết

Nếu browser gọi thẳng API, production có hai site khác nhau:

```text
Web: https://dike.vercel.app
API: https://dike-api.onrender.com
```

Cookie session do Render tạo thuộc `onrender.com`. Khi JavaScript đang chạy trên
`vercel.app` gọi API, browser xem đây là request cross-site và cookie trở thành
third-party cookie.

Điều này có thể tạo ra luồng lỗi:

1. Google callback đến Spring Boot thành công.
2. Spring Boot tạo session trong Redis và trả cookie.
3. Người dùng được chuyển về web.
4. Web gọi endpoint session trên Render.
5. Browser không gửi cookie vì chính sách `SameSite` hoặc chặn third-party cookie.
6. Web hiểu nhầm rằng người dùng chưa đăng nhập.

### 2.1. Vì sao chỉ cấu hình CORS là chưa đủ

CORS quyết định JavaScript có được đọc response từ origin khác hay không. Chính
sách cookie quyết định browser có lưu và gửi cookie hay không. Cấu hình
`Access-Control-Allow-Credentials` đúng không bảo đảm Safari, chế độ riêng tư hoặc
browser có chính sách chặn third-party cookie sẽ gửi session cookie.

### 2.2. Vì sao không dùng `SameSite=None` làm mặc định

`SameSite=None; Secure` cho phép cookie trong request cross-site nhưng làm session
phụ thuộc vào third-party cookie. Đây là cơ chế ngày càng bị browser hạn chế và
làm tăng độ phức tạp CORS/CSRF. Dike không chọn cơ chế này làm đường truy cập web
chuẩn.

## 3. Kiến trúc đã chọn

Browser chỉ gọi URL tương đối trên origin của web:

```text
https://dike.vercel.app/api/v1/auth/session
```

Next.js chuyển tiếp request đó tới API nội bộ đã cấu hình:

```text
https://dike-api.onrender.com/api/v1/auth/session
```

Response đi ngược lại qua Next.js. Đối với browser, request, response và cookie
đều thuộc `dike.vercel.app`; browser không phải sử dụng third-party cookie.

```text
┌──────────────────┐     same origin      ┌──────────────────┐
│ Browser          │ ───────────────────> │ Next.js/Vercel   │
│ dike.vercel.app  │   /api/* + cookie    │ reverse proxy    │
└──────────────────┘                      └────────┬─────────┘
                                                 │ server-to-server
                                                 ▼
                                        ┌──────────────────┐
                                        │ Spring Boot      │
                                        │ Render API       │
                                        └────────┬─────────┘
                                                 │
                                      MongoDB + Redis session
```

Namespace `/api/*` trên web được dành cho Spring Boot. Không tạo Next.js Route
Handler nghiệp vụ cạnh tranh trong namespace này.

## 4. Luồng Google OAuth/OIDC

Luồng browser mục tiêu:

1. Người dùng mở trang đăng nhập trên web.
2. Nút Google điều hướng browser tới endpoint bắt đầu OAuth dưới `/api/` của web.
3. Next.js proxy request tới Spring Boot.
4. Spring Security tạo authorization request với state, nonce và PKCE rồi redirect
   tới Google.
5. Google redirect về callback URL công khai thuộc origin web và nằm dưới `/api/`.
6. Next.js proxy nguyên callback tới Spring Boot.
7. Spring Security kiểm tra authorization code, state, nonce, PKCE và OIDC claims.
8. Module `identity` tạo hoặc tìm `AuthIdentity`/`User`, tạo opaque session trong
   Redis và trả `Set-Cookie`.
9. Browser nhận cookie first-party trên origin web rồi được redirect tới onboarding
   hoặc trang ứng dụng phù hợp.

Authorization code và Google token không được chuyển cho React, lưu trong
`localStorage` hoặc trả trong query string của trang web.

OAuth redirect URI đăng ký với Google phải là callback URL công khai qua web
proxy, không phải hostname Render nội bộ. Spring phải dùng public base URL được
cấu hình rõ hoặc chỉ tin forwarded header từ proxy đã biết; không tin tùy ý
`Host`/`X-Forwarded-*` do client gửi.

## 5. Cookie và CSRF

Cookie xác thực web:

- Là opaque random session ID; dữ liệu session thật nằm server-side trong Redis.
- `HttpOnly` để JavaScript không đọc được credential.
- `Secure` ở staging/production; local HTTP được cấu hình riêng.
- `SameSite=Lax` mặc định vì browser và API nhìn thấy cùng origin.
- `Path=/`; không đặt `Domain` rộng nếu không có nhu cầu đã được review.
- Không chứa Google access token, refresh token, profile hoặc role.

Các mutation vẫn phải kiểm tra CSRF vì browser tự gửi cookie:

- Spring Security phát CSRF token tách biệt với session credential.
- Web gửi token trong header `X-XSRF-TOKEN` cho request thay đổi trạng thái.
- Cookie CSRF có thể đọc bởi JavaScript; cookie session thì không.
- Spring kiểm tra thêm `Origin`/`Referer` theo allowlist cho mutation.
- Login callback được xử lý theo cơ chế state/nonce của OAuth, không tạo ngoại lệ
  CSRF rộng cho toàn bộ `/api/*`.

Không cache response auth, session hoặc dữ liệu cá nhân tại Vercel/CDN. Response
phải dùng chính sách `Cache-Control` phù hợp, tối thiểu `no-store` cho auth/session.

## 6. Phân chia trách nhiệm

| Trách nhiệm                        | Next.js proxy | Spring Boot |
| ---------------------------------- | ------------- | ----------- |
| Chuyển tiếp request/response       | Có            | —           |
| OAuth2/OIDC và Google integration  | Không         | Có          |
| Kiểm tra state, nonce và PKCE      | Không         | Có          |
| Tạo, refresh và revoke session     | Không         | Có          |
| Đọc/ghi Redis và MongoDB           | Không         | Có          |
| Authentication và authorization    | Không         | Có          |
| User, AuthIdentity và phone status | Không         | Có          |
| API nghiệp vụ và error contract    | Không         | Có          |

Proxy không được:

- Tự phát session hoặc JWT.
- Lưu Google/client secret trong biến public.
- Giải mã hoặc sửa body nghiệp vụ.
- Biến thành open proxy nhận upstream URL từ request.
- Cache response có cookie hoặc dữ liệu người dùng.

## 7. Yêu cầu proxy và cấu hình môi trường

Proxy phải:

- Chỉ chuyển tiếp tới một upstream Spring Boot được cấu hình server-side.
- Giữ method, query, body, `Content-Type`, cookie, CSRF header và request ID.
- Chuyển tiếp `Set-Cookie`, status và các header cần thiết theo allowlist.
- Đặt timeout và giới hạn body tương thích với API; không retry mutation tự động.
- Không ghi cookie, authorization code, token hoặc phone đầy đủ vào log.
- Truyền forwarded host/protocol theo cấu hình tin cậy để callback URL chính xác.

| Môi trường | Browser base URL            | API upstream                | Cookie session      |
| ---------- | --------------------------- | --------------------------- | ------------------- |
| Local      | `http://localhost:3000/api` | `http://localhost:8080/api` | `Secure=false`, Lax |
| Preview    | URL preview Vercel + `/api` | API staging được allowlist  | Secure, Lax         |
| Staging    | Web staging + `/api`        | Spring API staging          | Secure, Lax         |
| Production | Web production + `/api`     | Spring API production       | Secure, Lax         |

Preview deployment chỉ hoạt động khi callback URL/allowlist được quản lý có chủ
đích. Không dùng wildcard redirect URI của Google và không cho preview tùy ý truy
cập OAuth production.

## 8. Backend trực tiếp và Flutter

Spring Boot vẫn phải tự bảo vệ mọi endpoint vì proxy không phải security boundary.
Biết URL Render không được phép bỏ qua authentication, authorization, CSRF hoặc
validation.

Flutter sau này gọi API trực tiếp và dùng opaque mobile credential trong secure
storage theo ADR auth. Mobile không đi qua Next.js và không dùng cookie browser.
Hai client dùng chung `User`, `AuthIdentity`, session policy và API nghiệp vụ,
nhưng khác credential transport.

## 9. Kiểm thử bắt buộc

- E2E chạy từ origin web, qua proxy, hoàn thành Google/OIDC test flow và nhận
  session cookie first-party.
- Reload trang và gọi session endpoint vẫn xác thực được.
- Cookie session có đúng `HttpOnly`, `Secure` theo môi trường, `SameSite=Lax` và
  không chứa token Google.
- Mutation thiếu/sai CSRF token hoặc có `Origin` ngoài allowlist bị từ chối.
- Callback có state, nonce hoặc PKCE sai bị từ chối và không tạo user/session.
- Proxy không cache auth response, không trở thành open proxy và không retry POST.
- Logout/revoke làm cookie cũ vô hiệu ngay cả khi request đi trực tiếp tới API.
- Test xác nhận authorization code, session ID và token không xuất hiện trong log,
  URL trang web hoặc client-side storage.

## 10. Khi có custom domain

Nếu sau này dùng `app.dike.vn` và `api.dike.vn`, hai origin cùng site giúp cookie
dễ vận hành hơn nhưng vẫn cần CORS khi gọi trực tiếp. Dike mặc định tiếp tục dùng
same-origin proxy để giữ một đường truy cập web nhất quán. Bỏ proxy chỉ được thực
hiện bằng ADR mới sau khi kiểm thử cookie, CSRF, CORS, latency và vận hành.
