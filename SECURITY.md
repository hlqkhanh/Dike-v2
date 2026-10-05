# Security Policy

## Báo cáo lỗ hổng

Không đưa secret, token, PII, giấy tờ, vị trí nhạy cảm hoặc chi tiết khai thác vào GitHub Issue. Hãy báo riêng cho repository owner/Admin `hlqkhanh` qua kênh riêng đã thống nhất trong nhóm. Admin xác nhận đã nhận, phân loại mức độ và điều phối khắc phục.

Nếu chưa có kênh riêng an toàn, chỉ gửi mô tả tối thiểu không chứa dữ liệu nhạy cảm và yêu cầu Admin mở một kênh phù hợp.

## Khi phát hiện secret

1. Revoke hoặc rotate credential ngay; xóa file không làm credential an toàn trở lại.
2. Xác định phạm vi truy cập, log sử dụng và hệ thống bị ảnh hưởng.
3. Gỡ secret khỏi working tree và làm sạch history khi cần.
4. Thay credential ở môi trường liên quan bằng secret store phù hợp.
5. Chạy lại secret scan và ghi incident timeline ở nơi riêng tư.
6. Bổ sung guard hoặc tài liệu để ngăn tái diễn.

## Dữ liệu phát triển

Chỉ dùng dữ liệu tổng hợp, có thể tái tạo. Không dùng dữ liệu người thật, ảnh giấy tờ, database dump hoặc file upload production trong local/test.

## Phạm vi Stage 0

Stage 0 chưa triển khai runtime service và không cần deployment credential. CI quét secret trong toàn Git history; GitHub secret scanning/push protection được bật khi gói tài khoản hỗ trợ.
