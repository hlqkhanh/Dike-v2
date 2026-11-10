# Kế hoạch AI Assistant MVP cho Dike

Trạng thái: đã có implementation MVP backend, web và mobile; cấu hình và phạm vi thực tế tại [runbook AI Assistant](../docs/runbooks/ai-assistant.md). Chưa nghiệm thu model thật, tải pilot hoặc thiết bị thật.
Baseline khảo sát: main, commit 30fed86.

## 1. Mục tiêu và phạm vi

1. Một chatbot duy nhất nhận tiếng Việt, hỏi bổ sung và tạo bản nháp nhu cầu một lần hoặc lịch định kỳ; người dùng xem, sửa và xác nhận để lưu.
2. Trợ lý hướng dẫn tạo lịch, đặt chỗ, hủy chuyến và báo cáo; đọc trạng thái booking mà người dùng hiện tại được phép xem.

MVP triển khai backend dùng chung, nghiệm thu web trước, sau đó tích hợp mobile.
Chatbot dùng chung hội thoại cho tạo lịch/nhu cầu và hỏi đáp, tự phân loại ý định mỗi lượt và giữ ngữ cảnh bản nháp khi người dùng hỏi xen kẽ.
Chưa gồm giọng nói, tự đặt/hủy chuyến, tự đăng bài, thanh toán hoặc sửa/xóa lịch đã lưu bằng hội thoại. Tạo lịch và nhu cầu chỉ thực hiện sau thao tác xác nhận rõ ràng trên thẻ bản nháp hoặc form.

## 2. Các điểm phải giữ đúng với code hiện tại

- TravelIntentService.CreateManual chưa có số chỗ, phương tiện hoặc routeId. Không thêm các trường này vào domain chỉ để chứa kết quả AI: bản nháp AI riêng giữ dữ liệu và ánh xạ vào đúng luồng tạo nhu cầu/bài đăng hiện có.
- Vai trò đi ké trong TravelRole là RIDER; không để mô hình tự quyết định tên enum nghiệp vụ.
- PlaceService quản lý place session và placeRef theo người dùng; mô hình chỉ trích xuất tên địa điểm. Tọa độ và placeRef phải lấy từ dịch vụ địa điểm.
- RideService kiểm tra quyền truy cập booking. Trợ lý sử dụng public application API đã được công bố, không truy cập collection booking trực tiếp.
- Kiểm tra named interface, module dependency và ArchitectureVerificationTest trước khi quyết định vị trí facade mới; không import nội bộ module khác hoặc tạo dependency cycle.
- Không giữ Mongo transaction khi gọi mô hình hay nhà cung cấp bản đồ.

## 3. Luồng tạo nhu cầu bằng ngôn ngữ tự nhiên

1. Người dùng mở chatbot chung từ điều hướng hoặc màn tạo nhu cầu, ví dụ: “Mai 7 giờ sáng đi từ Thủ Đức tới ĐH FPT, cần 1 chỗ”.
2. Backend lấy thời gian từ Clock và múi giờ hợp lệ của người dùng, mặc định Asia/Ho_Chi_Minh; trích xuất thành dữ liệu theo schema.
3. Kết quả gồm originQuery, destinationQuery, localDate, departureLocalTime, seats, role, vehicleMode nếu được nói rõ, missingFields và clarification.
4. Backend kiểm tra schema, ngày/giờ, số chỗ và các giá trị cho phép. Giá trị thiếu phải để trống; không tự suy diễn hạn đến hoặc phương tiện.
5. Giao diện hiển thị các trường đã hiểu và câu hỏi cho thông tin còn thiếu. Thay đổi câu trả lời cập nhật bản nháp.
6. Giao diện tái sử dụng chọn địa điểm hiện tại: gọi autocomplete/resolve với actor và place session hợp lệ. Tên rộng như “Thủ Đức” hoặc nhiều cơ sở “ĐH FPT” yêu cầu chọn địa chỉ cụ thể.
7. Sau khi địa điểm hợp lệ, gọi routing hiện tại và điền vào form tạo nhu cầu. Kiểm tra lại placeRef/route hết hạn trước khi gửi.
8. Người dùng sửa, xem và bấm nút gửi hiện có. Giữ nguyên validation, quyền truy cập và idempotency của luồng nghiệp vụ.

Ngày tương đối như “mai”, “thứ sáu tới” được hiển thị thành ngày tuyệt đối để kiểm tra.
Câu “7 giờ” thiếu buổi hoặc không đủ ngữ cảnh phải hỏi lại; “7 giờ sáng” được chuẩn hóa thành 07:00.
Không gọi quy trình legacy requestMatch của travel intent để tạo booking.

### 3.1. Tạo lịch định kỳ trong cùng chatbot

1. Với câu “Thứ hai đến thứ sáu, 7 giờ sáng đi từ nhà tới ĐH FPT”, phân loại thành CREATE_SCHEDULE và hỏi thời hạn áp dụng, địa chỉ nhà/cơ sở FPT, giờ học/làm và chiều đi/về nếu còn thiếu.
2. Bản nháp có kiểu riêng scheduleDraft, gồm name, activityCategory, weekdays, effectiveFrom, effectiveUntil, startLocalTime, endLocalTime, zoneId, activityPlaceRef, usualOriginRef, arrivalBufferMinutes, directions, defaultTravelRole và visibility theo ScheduleService.RuleCommand.
3. Phân biệt giờ xuất phát trong câu nói với giờ bắt đầu/kết thúc hoạt động của schedule hiện tại. Không gán 07:00 xuất phát thành 07:00 bắt đầu học. Dùng route và buffer để gợi ý hoặc hỏi người dùng xác nhận các giờ tương ứng; nếu schema không biểu diễn được yêu cầu, giải thích và chuyển sang nhu cầu một lần hoặc form phù hợp.
4. “Nhà” chỉ được ánh xạ khi đã có địa chỉ được người dùng xác nhận trong ngữ cảnh; không suy ra địa chỉ từ vị trí hoặc tự tạo hồ sơ địa điểm lưu sẵn.
5. Hiển thị lịch lặp, ngày bắt đầu/kết thúc, múi giờ, địa chỉ, chiều đi/về, vai trò và quyền hiển thị. Mặc định quyền riêng tư theo chính sách form hiện tại và ghi rõ trên thẻ.
6. Kiểm tra xung đột theo ScheduleService; người dùng sửa các trường ngay trên thẻ/form và bấm “Xác nhận lưu lịch”. Backend validate lại, gọi public API planning phù hợp và trả scheduleId/link lịch đã lưu.
7. Lịch đã lưu được materialize bằng worker hiện có; không đồng thời tạo thêm travel intent thủ công cho cùng lịch. Lưu lịch không đồng nghĩa đã đăng bài hoặc có booking.

### 3.2. Trạng thái bản nháp và xác nhận

- Dùng intentDraft hoặc scheduleDraft với draftId, owner, version, trạng thái COLLECTING/READY/CONFIRMED/EXPIRED và thời hạn lưu.
- Backend giữ bản nháp có cấu trúc; không chỉ dựa vào lịch sử text của mô hình. Câu “đổi thành 8 giờ” cập nhật đúng bản nháp đang chọn; nhiều bản nháp thì hỏi lại.
- Chuyển sang hỏi đáp không làm mất bản nháp. Hủy bản nháp và bắt đầu yêu cầu mới là hành động riêng.
- Endpoint xác nhận lấy draftId/version cùng Idempotency-Key; kiểm tra ownership, dữ liệu bắt buộc, địa điểm hết hạn và quyền hiện tại trước khi ghi.
- Cùng một bản nháp xác nhận lặp phải trả cùng kết quả, không tạo hai lịch. Thiết kế cơ chế bền vững gắn draftId với kết quả tạo lịch trong cùng transaction MongoDB, vì Redis TTL không đủ bảo đảm idempotency khi lỗi giữa các bước.
- Không cho mô hình gọi công cụ xác nhận; chỉ thao tác UI rõ ràng của người dùng mới gọi endpoint ghi. MVP thực hiện lưu bằng văn bản “đồng ý” qua yêu cầu bấm nút xác nhận.

## 4. Luồng trợ lý hướng dẫn và tra booking

- Có màn trợ lý với câu hỏi gợi ý và điểm mở theo ngữ cảnh từ trang booking/tạo nhu cầu.
- Hướng dẫn lấy từ bộ bài viết sản phẩm có ID, phiên bản, nội dung được duyệt và action link được kiểm soát.
- MVP dùng danh mục nhỏ với tìm kiếm từ khóa/chủ đề; bổ sung vector search khi đánh giá cho thấy cần thiết.
- Không nạp toàn bộ runbook vận hành hoặc tài liệu chứa cấu hình nội bộ vào tri thức người dùng.
- Câu hỏi “Booking của tôi đang ở đâu?” gọi công cụ đọc booking qua service hiện có với actor từ phiên.
- Nếu có nhiều booking, hiển thị danh sách để chọn; nếu không có, trả trạng thái rỗng và đường dẫn tìm chuyến.
- Công cụ chỉ trả DTO tối thiểu: mã hiển thị, trạng thái, vai trò, thời gian và action hợp lệ. Không gửi mã lên xe, số tài khoản, số điện thoại hay vị trí chính xác vào mô hình.
- Trạng thái nên hiển thị bằng thẻ dữ liệu trực tiếp từ backend, có thời điểm cập nhật; văn bản AI chỉ giải thích thẻ đó.
- Câu hỏi hủy chuyến trả hướng dẫn và nút mở trang chi tiết. Việc hủy vẫn thực hiện trên màn nghiệp vụ hiện tại.
- Thiếu căn cứ thì thông báo chưa đủ thông tin; câu trả lời hướng dẫn kèm bài viết nguồn. Không tạo URL từ văn bản tự do của mô hình.

## 5. Thiết kế backend đề xuất

Một module assistant làm lớp điều phối, gồm API, application service và adapter nhà cung cấp mô hình. Domain hiện tại tiếp tục sở hữu nghiệp vụ.

Các thành phần dự kiến:

- AiGateway: abstraction gọi mô hình, timeout, lỗi chuẩn hóa và metadata sử dụng.
- IntentExtractionService: trích xuất bản nháp có schema, không ghi nghiệp vụ.
- ScheduleDraftService: ánh xạ câu nói sang schema lịch, kiểm tra ngữ nghĩa thời gian, trường thiếu và xung đột.
- DraftConfirmationService: kiểm tra và xác nhận bản nháp qua public API nghiệp vụ, bảo đảm version và idempotency.
- AssistantService: hội thoại và điều phối công cụ trong allowlist.
- HelpKnowledgeService: đọc bộ bài viết hướng dẫn đã duyệt.
- BookingReadFacade: public API tối thiểu do module ride sở hữu nếu API hiện tại chưa phù hợp.
- FakeAiGateway: kết quả xác định cho local/test; cấu hình hosted không âm thầm dùng dữ liệu giả.

API mới dự kiến:

| Endpoint                                           | Mục đích                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| POST /api/v1/assistant/intent-drafts               | Trích xuất/cập nhật bản nháp từ text và context đã kiểm tra                                       |
| POST /api/v1/assistant/drafts/{id}/confirm         | Xác nhận bản nháp đã kiểm tra từ thao tác UI, kèm version và Idempotency-Key                      |
| POST /api/v1/assistant/conversations               | Tạo hội thoại thuộc actor hiện tại                                                                |
| POST /api/v1/assistant/conversations/{id}/messages | Phân loại ý định, tạo/cập nhật bản nháp nhu cầu/lịch, hỏi bổ sung, trả hướng dẫn hoặc tra booking |
| DELETE /api/v1/assistant/conversations/{id}        | Xóa hội thoại của chính người dùng                                                                |

Endpoint messages là đầu vào hội thoại chung; intent-drafts là tiện ích cho form, dùng chung logic trích xuất, không tạo một chatbot riêng.
Response dùng các block có kiểu: text, clarification, intentDraft, scheduleDraft, helpReference, bookingCard, confirmationResult, actionLink.
Action link được ánh xạ từ action ID hợp lệ sang route web/mobile ở client.
MVP dùng REST response hoàn chỉnh; streaming là phần bổ sung sau khi đo trải nghiệm.

Hội thoại dùng Redis với TTL đề xuất 24 giờ, giới hạn lịch sử và kiểm tra ownership mỗi request. Không lưu raw prompt mặc định vào log hoặc MongoDB. Xóa cache khi người dùng xóa tài khoản theo lifecycle hiện có.

## 6. Phân quyền, độ tin cậy và vận hành

- Tất cả endpoint MVP yêu cầu đăng nhập; actor lấy từ Principal, không từ tool argument hoặc request body.
- Công cụ mô hình được gọi gồm tìm bài hướng dẫn, liệt kê/đọc booking được phép xem và tạo/cập nhật bản nháp nhu cầu/lịch. Công cụ kiểm tra địa điểm và xung đột dùng actor từ phiên, trả dữ liệu tối thiểu. Ghi nghiệp vụ chỉ qua endpoint xác nhận riêng do người dùng kích hoạt.
- Mọi tool call đều kiểm tra lại tham số và quyền; nội dung người dùng, tài liệu và đầu ra mô hình không cấp thêm quyền.
- Giới hạn đề xuất: input 2.000 ký tự, 10 request/phút/user, số lượt gọi công cụ và output token có trần cấu hình.
- Timeout, giới hạn chi phí ngày và feature flag; provider lỗi thì giữ nội dung đang nhập, cho thử lại hoặc chuyển nhập form thủ công.
- Không retry vô hạn; báo lỗi quá tải, mất kết nối và hết quota riêng biệt.
- API key chỉ ở backend; cấu hình provider/model qua môi trường. Chốt nhà cung cấp sau một thử nghiệm chất lượng/chi phí trên dữ liệu tổng hợp tiếng Việt.
- UI giải thích dữ liệu sẽ được xử lý bởi dịch vụ AI; kiểm tra và điều chỉnh consent/privacy hiện có trước khi mở pilot.
- Metrics: latency, lỗi schema, timeout, token/chi phí, tỉ lệ cần hỏi lại, tỉ lệ chấp nhận và sửa bản nháp; không gắn dữ liệu nhạy cảm vào nhãn metrics.

## 7. Giao diện

Web: một màn chatbot chung với gợi ý “Tạo nhu cầu”, “Tạo lịch định kỳ”, “Hỏi cách sử dụng”, “Xem booking của tôi”; hỗ trợ mở theo ngữ cảnh từ form/trang booking. Trong hội thoại hiển thị thẻ bản nháp có thể sửa/xác nhận, chọn địa điểm, thẻ booking và nguồn hướng dẫn.
Mobile: cùng một chatbot và contract, tái sử dụng PlacePicker cùng form hiện tại; action link ánh xạ sang Expo Router.
Các trạng thái cần có: ban đầu, đang xử lý, cần bổ sung, có kết quả, không có booking, lỗi dịch vụ, offline và phiên hết hạn.
Giữ bản nháp khi provider lỗi; tránh để nút trợ lý che thao tác chính.

## 8. Thứ tự thực hiện và nghiệm thu

| Giai đoạn                            | Công việc                                                                              | Điều kiện hoàn thành                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1. Contract và thử nghiệm            | Chốt schema, 50–100 câu mẫu tổng hợp, nội dung hướng dẫn, thử provider                 | Có bộ dữ liệu đánh giá và thiết kế module không vi phạm dependency                                    |
| 2. Backend nền                       | Gateway, fake adapter, feature flag, rate limit, error contract, OpenAPI               | Contract/client đồng bộ; test schema, ownership và lỗi provider đạt                                   |
| 3. Chatbot tạo nhu cầu/lịch trên web | Phân loại ý định, hội thoại bổ sung, hai kiểu bản nháp, địa điểm, xung đột và xác nhận | Tạo được nhu cầu một lần và lịch định kỳ; chưa xác nhận không ghi; xác nhận lặp không tạo trùng       |
| 4. Hỏi đáp trong chatbot chung       | Tri thức, công cụ booking, thẻ dữ liệu, action link, đổi ý định giữa các lượt          | Trả lời có nguồn; đọc đúng booking; hỏi xen kẽ không mất bản nháp; câu trả lời không tự kích hoạt ghi |
| 5. Mobile                            | Dùng API chung, tích hợp form và màn trợ lý                                            | Nghiệm thu cùng tình huống với web trên thiết bị mục tiêu                                             |
| 6. Pilot                             | Đánh giá chất lượng, chi phí, latency, giới hạn và fallback                            | Đạt tiêu chí dưới đây, có thể tắt AI mà nghiệp vụ chính vẫn hoạt động                                 |

## 9. Kiểm thử và tiêu chí phát hành

- Bộ câu mẫu bao gồm tiếng Việt không dấu, viết tắt, thiếu địa chỉ, nhiều cơ sở FPT, mốc ngày qua nửa đêm, giờ mơ hồ, thời gian quá khứ và số chỗ sai.
- Bổ sung lịch “thứ hai đến thứ sáu”, ngày bắt đầu/kết thúc, một/hai chiều, giờ xuất phát so với giờ hoạt động, buffer, xung đột và ngoại lệ yêu cầu chưa hỗ trợ.
- E2E hội thoại nhiều lượt: tạo lịch → hỏi cách hủy booking → quay lại sửa giờ → xác nhận; dữ liệu và bản nháp phải thuộc đúng người dùng.
- Test xác nhận draft hết hạn/sai version, địa điểm hết hạn, thay đổi quyền, gửi lặp và lỗi sau khi nghiệp vụ commit nhưng trước khi trả response; không tạo lịch trùng.
- Mục tiêu ban đầu: tối thiểu 90% đúng các trường được nói rõ trên tập đánh giá giữ riêng; báo cáo theo từng trường, không chỉ một điểm tổng.
- Địa điểm chưa được resolve không được coi là đã xác nhận; không chấp nhận tọa độ/placeRef do mô hình tự tạo.
- Test booking người khác, conversation người khác, phiên hết hạn và prompt yêu cầu bỏ qua phân quyền đều không tiết lộ dữ liệu.
- Test nội dung độc hại trong câu hỏi/tài liệu không mở rộng allowlist công cụ hoặc tạo action tùy ý.
- Thẻ trạng thái booking phải khớp service trả về; có test đổi trạng thái giữa các lượt hỏi.
- Test timeout, provider trả JSON sai, quota, địa điểm hết hạn, bấm gửi lặp và fallback form.
- Unit/service test cho logic mới; integration/architecture/contract test cho backend; E2E cho hai luồng chính và các trường hợp từ chối quyền.
- Chạy lint/typecheck cho client bị thay đổi, API contract check và Maven verify theo gate của repository.
- Mục tiêu latency ban đầu: p95 dưới 10 giây ở tải pilot đã xác định; điều chỉnh sau spike và ghi rõ môi trường đo.

## 10. Ước lượng và quyết định còn lại

Ước lượng sơ bộ cho một lập trình viên quen repository: 16–24 ngày công cho backend, web, mobile và kiểm thử, bao gồm lịch định kỳ, hội thoại nhiều lượt và xác nhận chống trùng; chưa gồm thời gian chờ tài khoản dịch vụ hoặc thay đổi consent lớn. Cần hiệu chỉnh sau giai đoạn 1.

Mặc định thực hiện web trước, đăng nhập bắt buộc, một chatbot tạo bản nháp nhu cầu/lịch và trả lời câu hỏi; lưu sau xác nhận rõ ràng của người dùng. Các quyết định cần chốt trong spike: provider/model, ngân sách pilot, ánh xạ giờ xuất phát sang lịch hoạt động và nội dung hướng dẫn đã được duyệt.
