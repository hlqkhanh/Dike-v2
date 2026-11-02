# Bật tìm địa điểm và tính tuyến đường cho demo

Thông báo `DEMO_FEATURE_DISABLED` khi nhập địa điểm xuất phát từ
`DemoFeatureFilter`, trước khi gọi Goong. Nền bản đồ dùng OpenFreeMap và đã có thể
hiển thị độc lập; không cần Maptiles key để sửa lỗi tìm địa điểm này.

## Cấu hình Render

Áp dụng bản code hỗ trợ Goong demo trước, sau đó đặt các biến sau trên service
`dike-api-demo` (giữ profile `demo,combined`):

| Biến                            | Giá trị                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `DIKE_ROUTING_PROVIDER`         | `goong`                                                              |
| `DIKE_GOONG_API_KEY`            | REST API key hợp lệ, nhập dưới dạng secret trên Render               |
| `DIKE_ROUTING_CACHE_KEY_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, giữ ổn định giữa các lần deploy |

Base URL mặc định là `https://rsapi.goong.io`. Code từ chối host khác và key
placeholder khi bật Goong trên demo. Blueprint mặc định giữ routing disabled;
thêm cache secret được sinh tự động cho service mới. Với service đã có, nhập
secret vào Environment rồi Save/Rebuild/Redeploy. Không cần đổi profile, tạo
worker trả phí hoặc bật OTP/storage.

Key chỉ đặt trên Render backend. Không đặt trong `NEXT_PUBLIC_*`, URL public,
source code hoặc gửi qua chat. Dùng **REST API key**, không dùng Maptiles key.
Kiểm tra quota và trạng thái tài khoản Goong trước khi bật; việc này không yêu
cầu nâng gói Render/Vercel hay bật thanh toán tự động cho Goong.

Demo vẫn yêu cầu phiên Google hợp lệ và CSRF cho các thao tác POST. Thành viên
demo có thể tìm địa điểm và tính tuyến mà không được cấp thêm quyền tài xế hoặc
VERIFIED_MEMBER. Rate limit/cache sẵn có tiếp tục áp dụng.

## Kiểm tra sau khi deploy

1. Đăng nhập tại `https://dike-v2.vercel.app` và mở `/rides/new`.
2. Tìm `FPT`, chọn một gợi ý cho điểm đi và một điểm đến.
3. Kiểm tra POST `/api/v1/routing/place-sessions`, GET `/api/v1/routing/places`
   và POST `/api/v1/routing/places/resolve` trả thành công.
4. Tính tuyến; POST `/api/v1/routing/routes` trả `provider=GOONG`, geometry,
   khoảng cách và thời gian. Đây mới là bằng chứng provider hoạt động, không
   dùng việc nền bản đồ hiển thị để kết luận.
5. Xác nhận OTP, file và developer login vẫn không hoạt động trên demo.

`DEMO_FEATURE_DISABLED` còn xuất hiện: kiểm tra commit backend và provider đang
deploy. `ROUTING_UNAVAILABLE` sau khi đã bỏ chặn: kiểm tra Goong REST key, quota,
quyền gọi API và log đã che secret. Không log URL có `api_key` hoặc raw key.

## Tắt lại

Đặt `DIKE_ROUTING_PROVIDER=disabled` rồi restart/redeploy backend. Filter lại chặn
toàn bộ routing API; không phát sinh cuộc gọi Goong từ các endpoint này.

Nguồn: [Goong phân biệt REST và Maptiles key](https://document.goong.io/tutorial-API-key.html).
