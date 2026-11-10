# Trợ lý Dike

## Mở tính năng

- Web: **bong bóng chat ở góc dưới bên phải** sau đăng nhập. Bấm để mở khung chat ngay trên trang; thu nhỏ hoặc nhấn Escape để đóng. Nội dung được giữ khi chuyển trang trong ứng dụng. Link cũ `/assistant` chuyển về `/home` và tự mở khung chat.
- Mobile: **Cài đặt → Trợ lý Dike**, route `/assistant`.
- Yêu cầu phiên đăng nhập hợp lệ; quyền tạo lịch/tài xế vẫn do planning/identity kiểm tra.

Đăng nhập thử nghiệm local mặc định tắt (`DIKE_DEV_AUTH_ENABLED=false`). Dùng luồng Google để đăng nhập; chatbot không tạo phiên hoặc bỏ qua xác thực. Các phiên thử nghiệm đã tạo trước đó không tự bị thu hồi khi đổi cấu hình.

Trợ lý dùng một màn hội thoại cho tạo nhu cầu một lần, tạo lịch định kỳ, hướng dẫn sử dụng và tra booking.
Giao diện web/mobile dùng cùng API backend. Mô hình trích xuất, phân loại ý định và soạn câu trả lời trực tiếp dựa trên các bài kiến thức được duyệt. Backend chọn nguồn/liên kết từ danh mục có sẵn và trả thẻ booking từ service thật. Các câu hỏi giới thiệu nền tảng, quyền riêng tư và xác minh có nội dung riêng; “Dike là gì?” không dùng đoạn giới thiệu chatbot. Nút hướng dẫn nhanh tiếp tục trả bài viết cố định và hoạt động khi AI tắt.

## Cấu hình backend

```dotenv
DIKE_ASSISTANT_ENABLED=true
DIKE_ASSISTANT_API_KEY=<key của dịch vụ Gemini>
DIKE_ASSISTANT_MODEL=gemini-3.5-flash-lite
DIKE_ASSISTANT_DAILY_REQUEST_LIMIT=500
```

Đặt giá trị trong môi trường riêng của backend/API. Không đưa API key vào `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, file commit hoặc chat. Khởi động lại backend sau khi đổi cấu hình. Chọn model mà tài khoản dịch vụ được phép dùng; kiểm tra availability trước khi mở pilot.

Ngày 10/11/2026, cấu hình local đã được kiểm tra bằng request structured-output thật: `gemini-2.5-flash` trả 404 do không còn mở cho tài khoản mới; `gemini-3.5-flash-lite` trả 200 và trích xuất được nhu cầu tiếng Việt. Model mặc định được cập nhật theo kết quả này. Gateway phân biệt lỗi key/quyền, model không khả dụng, request bị từ chối, quá tải, quota và timeout; log chỉ ghi status/model hoặc loại lỗi, không ghi key, prompt hay response body.

Mặc định AI tắt. Các nút hướng dẫn và “Xem booking của tôi” vẫn hoạt động khi không có key. Nhập tự nhiên báo `ASSISTANT_NOT_CONFIGURED` và cho chuyển sang form. Không tự dùng mô hình giả trong production.

Adapter dùng REST `generateContent` và structured output theo [tài liệu Gemini](https://ai.google.dev/api/generate-content). Input tối đa 2.000 ký tự, output tối đa 4.096 token, timeout mỗi request tối đa 15 giây. Chỉ khi provider trả HTTP 503, đợi 500 ms rồi thử lại một lần với cùng model và nội dung; tổng thời gian gọi provider giới hạn khoảng 20 giây. Không tự retry lỗi quota 429, API key, request hoặc timeout. Mỗi lượt người dùng có thể phát sinh tối đa hai request provider. Giới hạn chung số lượt AI/ngày và 10 request/phút/user giúp giới hạn sử dụng; đây không phải hạn mức thanh toán theo tiền của nhà cung cấp.

## Luồng tạo dữ liệu

1. Nhập yêu cầu tiếng Việt. Câu trả lời tiếp theo và các ô sửa trên thẻ cập nhật cùng bản nháp.
2. Chọn hai địa chỉ từ dịch vụ autocomplete/resolve; không chấp nhận địa chỉ/tọa độ do mô hình tự tạo.
3. Với lịch định kỳ, cung cấp ngày bắt đầu/kết thúc, ngày lặp, giờ bắt đầu/kết thúc học/làm, chiều di chuyển và vai trò. Giờ xuất phát không tự trở thành giờ bắt đầu hoạt động.
4. Trên web, với chuyến một lần, chọn hai địa chỉ chính xác, ngày giờ đi, vai trò, phương tiện và số chỗ trong chat. Bấm **Tìm bài phù hợp và đăng bài** để tự tính tuyến và đóng góp gợi ý, chuyển sang bước 3 tại `/rides/new` và tự tìm bài phù hợp. Nếu thiếu thông tin hoặc tính tuyến thất bại, giữ nguyên bản nháp và báo lỗi trong chat. Không yêu cầu hạn đến nơi trong luồng này.
5. Xem kết quả tìm bài và bấm **Đăng bài**, hoặc quay lại chỉnh sửa nếu cần. Tôi chở tạo trip và bài đăng; Tôi đi ké tạo bài đăng cần đi ké. Trước khi xác nhận đăng chưa có dữ liệu chuyến/bài đăng mới. Bản nháp chuyển trang được giữ trong bộ nhớ và sessionStorage của tab, gắn với tài khoản, hiệu lực tối đa 30 phút. Tải lại cùng tab khôi phục bước tìm bài; tuyến thiếu/hết hạn được tính lại. Link mở ở tab khác hoặc bản nháp hết hạn cần được chuyển lại từ chat.
6. Với lịch định kỳ, bấm **Xác nhận lưu lịch** để lưu riêng tư. Worker hiện có materialize lịch, kèm cảnh báo xung đột trong 31 ngày đầu nếu có.

Mobile và API confirm nhu cầu một lần vẫn tạo `TravelIntent` riêng tư, yêu cầu ngày đi, giờ đi và hạn đến nơi; web chuyển sang form đăng chuyến thay cho gọi confirm nhu cầu. Lịch chỉ hỗ trợ múi giờ `Asia/Ho_Chi_Minh`, hoạt động bắt đầu/kết thúc trong cùng ngày theo domain hiện tại.

Xác nhận dùng draft ID do server sinh làm idempotency key cố định. `AtomicCommands` ghi receipt và schedule/intent trong cùng Mongo transaction; việc retry sau mất response không tạo thêm bản ghi. Sau khi đã lưu, yêu cầu tạo mới nhận draft ID mới. Không có công cụ mô hình nào được gọi endpoint xác nhận, hủy chuyến, thanh toán hoặc thay đổi booking.

## Dữ liệu và quyền riêng tư

- Redis chứa bản nháp có cấu trúc, không lưu toàn bộ lịch sử chat; TTL 24 giờ sau lần lưu gần nhất, key có environment và actor. UI giữ tối đa khoảng 20 lượt gần nhất trong bộ nhớ, không khôi phục toàn bộ chat khi tải lại trang.
- Actor lấy từ Principal, không lấy từ câu nói hoặc tool argument. Hội thoại người khác trả 404.
- Chỉ gửi nội dung người dùng và các trường bản nháp đến provider. Không gửi booking, mã lên xe, số điện thoại, tài khoản ngân hàng hoặc vị trí GPS cho mô hình.
- Các nút hướng dẫn/tra booking hoạt động trực tiếp trên server, không gửi nội dung sang provider. Xóa hội thoại xóa state Redis; consumer `assistant.account-deletion.v1` dọn dữ liệu khi xử lý sự kiện xóa tài khoản.
- Tra booking đọc tối đa 20 booking gần nhất qua RideService với actor; lọc ngày Việt Nam nếu người dùng hỏi ngày cụ thể. Thẻ trạng thái có thời điểm tra cứu, liên kết đến trang chi tiết để thao tác.
- Metrics không chứa prompt: `dike.assistant.provider.duration`, `dike.assistant.provider.errors`, `dike.assistant.provider.tokens`.

## Contract và kiểm thử

API:

- `POST /api/v1/assistant/conversations`
- `GET/DELETE /api/v1/assistant/conversations/{id}`
- `POST /api/v1/assistant/conversations/{id}/messages`
- `POST /api/v1/assistant/conversations/{id}/confirm`

Không có endpoint `intent-drafts` riêng: toàn bộ trích xuất đi qua messages để giữ một luồng hội thoại. Body messages nhận `text` và tùy chọn `draftVersion`, `fields` để đồng bộ ô sửa. Confirm nhận version, fields và hai placeRef đã resolve. Xác nhận sử dụng idempotency key cố định từ draft, không nhận key tùy ý từ mô hình/client.

```powershell
.\mvnw.cmd -B -ntp verify
pnpm --filter @dike/web typecheck
pnpm --filter @dike/web lint
pnpm --filter @dike/mobile typecheck
pnpm --filter @dike/mobile lint
pnpm api:check
pnpm --filter @dike/web exec playwright test e2e/assistant.spec.ts
```

Khi thay record contract:

```powershell
.\mvnw.cmd -B -ntp -pl apps/backend -am '-Dtest=AssistantContractTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DupdateAssistantContract=true' test
pnpm api:generate
```

Backend tests dùng mock AI, không gọi dịch vụ tính phí. Browser tests dùng API fixtures để kiểm tra giao diện desktop/mobile. Trước pilot cần chạy integration với Mongo replica set/Redis thật, thử model bằng key riêng trên bộ câu tiếng Việt giữ riêng, đo chất lượng/latency/chi phí và nghiệm thu trên thiết bị Android/iOS. Các kiểm tra fixture không chứng minh độ chính xác thực tế của mô hình hoặc chất lượng trên thiết bị thật.
