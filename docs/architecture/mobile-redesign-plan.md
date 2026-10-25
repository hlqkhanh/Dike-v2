# Kế hoạch redesign Dike Mobile

Cập nhật: 20/10/2026. Trạng thái: đã triển khai giao diện, đang nghiệm thu native
và API thật; chi tiết bằng chứng ở cuối tài liệu. Đây là đợt làm mới mỹ thuật sau
`mobile-ui-plan.md`, dựa trên Home mobile và bộ hình ảnh web hiện tại.

## Phạm vi và nguyên tắc

- Đồng bộ phong cách minh họa xanh, mascot, nền phong cảnh và typography của web;
  bố cục và tương tác được thiết kế riêng cho điện thoại.
- Giữ Google login thật, route guard, onboarding theo `nextAction`, API, quyền
  người dùng, phân trang và cơ chế chống gửi lặp đang có. Không khôi phục bypass.
- Phạm vi là toàn bộ màn hình thành viên hiện có; không thêm trang quản trị.
- Không tạo nút chức năng hoặc số liệu giả để lấp bố cục. Chức năng chưa có backend
  chỉ hiển thị thông tin trạng thái thực, đặc biệt eKYC và push từ server.
- Home là tham chiếu đã chốt: hai card chữ nhật ngang, không có chữ phụ/mũi tên;
  navbar bốn icon, không hiển thị nhãn nhưng giữ nhãn cho trình đọc màn hình.

## Hệ thống thiết kế

| Thành phần  | Quyết định                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Màu         | Nền mint `#f3faf7`, emerald `#087d61`, chữ `#12342d`, phụ `#526e62`; vàng kem dành cho người đi ké                                   |
| Chữ         | Plus Jakarta Sans hiện có; tiêu đề trang 26–32, tiêu đề khối 18–22, nội dung 14–16; hỗ trợ tăng cỡ chữ hệ thống                      |
| Khoảng cách | Lề 20–24; nhịp 8/12/16/24/32; tránh khối nội dung quá sát navbar                                                                     |
| Card        | Bo 22–28, viền mint mờ, bóng mềm; phân biệt rõ card có thể bấm và card thông tin                                                     |
| Header      | Màn gốc có logo/thông báo; màn con có quay lại và tiêu đề; hero không lặp lại cùng một tiêu đề                                       |
| CTA         | Một hành động chính nổi bật mỗi bước; hành động phụ nhẹ hơn; hành động nguy hiểm cần xác nhận                                        |
| Icon        | Một bộ icon thống nhất; vùng chạm tối thiểu 48; không dùng emoji thay icon chức năng                                                 |
| Kính        | Tập trung ở navbar; iOS hỗ trợ dùng Liquid Glass, nền tảng khác dùng component thay thế; không dùng kính dưới form hoặc đoạn văn dài |
| Chuyển động | Fade/slide ngắn cho trạng thái, chuyển bước và sheet; tôn trọng Reduce Motion; không parallax nền lớn                                |

Nền minh họa phải phủ kín chiều ngang và giữ tỷ lệ; tách lớp ảnh khỏi padding
nội dung. Không kéo giãn ảnh hoặc đặt chữ trực tiếp trên vùng ảnh nhiều chi tiết.
Ưu tiên overlay nhẹ hoặc vùng nền sạch để chữ có tương phản đủ tốt.

## Dùng chung ảnh web

Nguồn: `apps/web/public/images`. Khai báo đường dẫn tĩnh tại
`apps/mobile/src/core/assets.ts`; mở rộng thành nhóm theo mục đích khi số lượng tăng.
Không copy thêm ảnh vào mobile nếu có thể dùng source web trực tiếp.

| Nhóm             | Ảnh gốc / ứng viên                                                           | Cách dùng                                                                          |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Thương hiệu      | `logo.png`                                                                   | Logo header và đăng nhập; không dùng ảnh có chữ nhỏ bị thu bé                      |
| Home             | `dike_top_banner.png`, `botanical_leaves.png`                                | Banner và điểm nhấn lá; giữ bố cục Home đã chốt                                    |
| Vai trò          | `green ride duck.png`, `yellow waiting duck.png`                             | Card chọn vai trò, đầu bước tạo hành trình; giữ nguyên tỷ lệ mascot                |
| Tuyến đường      | `background-home.png`, `Đường ven hồ giữa thiên nhiên xanh mát.png`          | Cover chi tiết hành trình và tóm tắt tuyến; không thay bản đồ dữ liệu thật         |
| Trống / khám phá | `Bản đồ xanh giữa đồi sương mint.png`                                        | Trạng thái chưa có chuyến, chưa có kết quả; hình nhỏ hơn trên màn có nhiều dữ liệu |
| Lịch trình       | `Minh họa lịch trình du lịch xanh.png`                                       | Hero lịch lặp hoặc trạng thái chưa tạo lịch                                        |
| Đặt chỗ          | `Vé xanh giữa cảnh đường ven hồ.png`                                         | Đầu trang booking, trạng thái đặt chỗ; mã lên xe nằm trong khối dữ liệu riêng      |
| Tin nhắn         | `Bong bóng trò chuyện giữa thiên nhiên.png`                                  | Inbox rỗng; không làm nền phía sau bubble chat                                     |
| Hồ sơ            | `Toàn cảnh thành phố xanh bên sông.png`, `Hành trình xanh giữa núi trời.png` | Cover hồ sơ có crop phù hợp, không che avatar/tên                                  |
| Đăng nhập        | `login_bg_clean.png`, `dike_banner_transparent.png`                          | Thử crop trên màn nhỏ, chọn một hướng nhất quán với Home                           |

Các ảnh ngoài nhóm Home là ứng viên: xem ảnh gốc và thử crop trước khi chốt từng
màn. Không dùng file `login-ref.png` hoặc ảnh chụp UI làm nền của UI mới.
Với thông báo/xác minh, nếu chưa có ảnh chuông/khiên độc lập phù hợp thì dùng icon
và nền mint; không cắt hình từ screenshot web.

Ảnh trang trí không nhận focus và không đọc lặp qua screen reader. Avatar thật
tiếp tục lấy từ API; không thay bằng avatar mẫu trong thư mục ảnh web.
Đo dung lượng thực tế; tránh đưa ảnh hero nhiều MB vào mọi màn. Chỉ tối ưu thêm
biến thể khi cần và giữ ảnh nguồn nguyên vẹn.

## Bố cục theo từng màn hình

| Route                     | Hướng redesign                                                                   | Nội dung và tương tác cần giữ                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                | Hero xanh đồng bộ Home, logo gọn, thông điệp ngắn, Google CTA rõ                 | Google thật, pending, hủy/lỗi, thử kết nối lại; không ô token hoặc bypass                                               |
| `/`, `/auth/callback`     | Trạng thái khởi động/xác thực tối giản, có tiến trình rõ                         | Khôi phục phiên, xử lý callback và chuyển màn đúng; không lộ code/token                                                 |
| `/onboarding/phone`       | Form một nhiệm vụ, minh họa nhỏ, bước số điện thoại → OTP                        | Validation, gửi lại/đếm ngược, lỗi và `phoneVersion`; không mất nội dung khi mở bàn phím                                |
| `/(tabs)`                 | Chuẩn hóa lại Home theo quyết định mới nhất, ưu tiên phần banner/card            | Tìm kiếm, lọc ngày/vai trò, phân trang và refresh API thật                                                              |
| `/(tabs)/trips`           | Header phong cảnh thấp, nhóm trạng thái, card dạng vé hành trình                 | Phân biệt chuyến và booking; giờ, vai trò, trạng thái, CTA đúng quyền                                                   |
| `/posts/[id]`             | Cover tuyến thấp; người đăng và tuyến nổi bật; thông tin giờ/ghế/chi phí dễ quét | Kiểm tra đón, gửi yêu cầu, phản hồi chủ bài, đóng bài, chat và report                                                   |
| `/create-trip`            | Chia biểu mẫu thành bước: vai trò/tuyến → thời gian/chi phí → xem lại            | Khởi tạo đúng mode từ Home, gợi ý địa điểm thật, route preview, giữ draft trong phiên và tiến trình publish chống trùng |
| `/trip/[id]`              | Timeline chuyến làm nội dung chính, tóm tắt tuyến và nhóm thành viên rõ          | Điểm dừng, phiên bản trạng thái, bắt đầu/kết thúc/hủy và xác nhận đúng quyền                                            |
| `/booking/[id]`           | Thiết kế vé xanh, trạng thái lớn, mã lên xe dễ tìm và dễ đọc                     | Thông tin người tham gia, thao tác theo trạng thái, lý do hủy và đánh giá khi đủ điều kiện                              |
| `/schedules`              | Lịch theo tuần, ngày chọn dạng chip, card lịch gọn                               | Tạo/sửa/tạm dừng/tiếp tục/kết thúc; trạng thái thật                                                                     |
| `/schedules/edit`         | Form chia nhóm, ngày và khung giờ dễ chọn, preview lịch lặp                      | Giá trị hiện tại, chọn nơi thật, validation, `If-Match` khi sửa                                                         |
| `/(tabs)/inbox`           | Header thấp, tìm kiếm, avatar lớn vừa đủ, unread dễ phân biệt                    | Nội dung/timestamp tin gần nhất nếu API có, trạng thái request, refresh                                                 |
| `/chat/[id]`              | Header người nhận; nền mint rất nhạt; bubble và composer rõ                      | Poll/read sequence, retry giữ client message ID, request accept/reject, đính kèm hiện có và keyboard safe area          |
| `/notifications`          | Header chuông gọn, nhóm theo ngày, card trắng và dấu chưa đọc                    | Đọc tất cả, đánh dấu đã đọc trước điều hướng, deep link đúng đối tượng                                                  |
| `/(tabs)/profile`         | Cover phong cảnh, avatar, tên và huy hiệu; mục chức năng thành nhóm              | Chỉ hiện thống kê có dữ liệu thật; sửa hồ sơ, lịch trình, cài đặt, đăng xuất                                            |
| `/user/[id]`              | Đồng bộ hồ sơ cá nhân nhưng ưu tiên độ tin cậy và hành động liên hệ              | Profile/ratings/reviews từ API, nhắn tin, block/report đúng quyền                                                       |
| `/settings`               | Header nhỏ, danh sách nhóm: tài khoản, quyền, bảo mật, ứng dụng                  | Mỗi hàng mở đúng trang; không minh họa lớn làm danh sách dài thêm                                                       |
| `/settings/profile`       | Form hồ sơ sạch, avatar preview, CTA lưu rõ                                      | Tên/bio/Facebook, validation, phiên bản, thông báo lưu thành công                                                       |
| `/settings/privacy`       | Tùy chọn dạng card có giải thích ngắn                                            | Quyền riêng tư thật, trạng thái chọn, lưu và refetch đúng version                                                       |
| `/settings/security`      | Card thiết bị với phiên hiện tại nổi bật, cảnh báo vừa đủ                        | Thu hồi phiên có xác nhận, đăng xuất, lỗi/thử lại                                                                       |
| `/settings/notifications` | Minh họa chuông nhỏ, phân biệt quyền thiết bị và inbox                           | Không tải module push trong Expo Go; không coi cấp quyền là đã có server push                                           |
| `/settings/consent`       | Danh sách tài liệu dễ đọc, version và trạng thái rõ                              | Xem/chấp thuận đúng tài liệu, tuân thủ onboarding; không tick hộ người dùng                                             |
| `/verification`           | Hero khiên nhỏ, danh sách bước và bằng chứng xác minh                            | Trạng thái API, không tạo luồng eKYC hay quyền tài xế giả                                                               |
| Report/block sheet        | Đồng bộ sheet, lựa chọn lý do, ô nội dung và CTA rõ                              | Xác nhận, pending, lỗi, kết quả thật; không submit trùng                                                                |
| `/ui-gallery`             | Bộ tham chiếu component có các trạng thái và cỡ chữ                              | Chỉ công cụ development; không là lối vào các trang riêng tư                                                            |

Các bước của form là thay đổi trình bày trong route hiện có, không mặc định tạo
thêm route hoặc thay hợp đồng API. Nếu có nhu cầu endpoint mới, ghi riêng trước
khi đưa vào phạm vi triển khai.

## Component cần chuẩn hóa

1. `Screen` / `DetailPage`: header, safe area, khoảng trống navbar, refresh và keyboard.
2. `ArtHeader`: các biến thể Home, cover thấp và icon header; kiểm soát crop/overlay.
3. `TripCard` / `BookingTicket` / `RouteSummary`: dữ liệu tuyến và trạng thái nhất quán.
4. `RoleCard`: ảnh xanh/vàng, dạng ngang, chỉ tiêu đề, không mũi tên.
5. `FormSection` / `StepHeader` / `ActionBar`: nhóm trường, tiến trình và CTA form.
6. `EmptyState` / `LoadingCards` / lỗi thử lại: đúng ngữ cảnh, không nhầm lỗi mạng với rỗng.
7. `TabBarGlass`: chỉ icon, nhãn accessibility, nhánh iOS native và nền thay thế.
8. Bottom sheet xác nhận và chọn lý do dùng chung; không thay kiểu tương tác mỗi trang.

Không trừu tượng hóa mọi màn thành một template duy nhất. Chat, form và timeline
có nhu cầu cuộn/keyboard riêng; chỉ dùng chung các phần có cùng hành vi.

## Thứ tự thực hiện

| Đợt | Phạm vi                                                                    | Kết quả cần duyệt                                                            |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Chuẩn hóa asset/token, header, navbar, state; rà lại Home                  | Ảnh Home và gallery tại 360/390/430 px; chốt quy tắc dùng hình               |
| 2   | Trips → post detail → trip detail → booking                                | Một luồng khám phá, xem chi tiết và theo dõi hành trình đồng bộ              |
| 3   | Create trip → schedules → schedule edit                                    | Form có phân bước, preview và trạng thái gửi rõ; không mất logic chống trùng |
| 4   | Inbox → chat → notifications                                               | Luồng giao tiếp đồng bộ, keyboard/composer hoạt động đúng trên thiết bị      |
| 5   | Profile → public profile → settings và các trang con → verification/report | Hồ sơ và cài đặt có cùng ngôn ngữ hình ảnh, mọi hành động giữ API thật       |
| 6   | Sign-in → callback → phone/OTP/consent, kiểm tra xuyên suốt                | Luồng vào app đồng bộ; hồi quy xác thực và onboarding đầy đủ                 |

Mỗi đợt hoàn thành cả màn có dữ liệu, loading, rỗng và lỗi trước khi chuyển sang
đợt sau. Không ước lượng số ngày cố định trước khi kiểm tra crop ảnh và độ phức
tạp của form trên thiết bị.

## Kiểm tra và nghiệm thu

- Chụp từng màn ở 360/390/430 px; đối chiếu web và Home đã chốt. Không tràn ngang,
  crop mất chủ thể, chữ phủ vùng ảnh rối, tab che CTA hoặc trạng thái chỉ phân biệt bằng màu.
- Kiểm tra cỡ chữ lớn, tên dài, tiếng Việt, vùng chạm, screen reader, safe area,
  bàn phím, cuộn tới CTA và Reduce Motion/Reduce Transparency.
- Giữ thông tin chuyến, thời gian và hành động quan trọng trên nền đọc rõ;
  hình trang trí không chiếm ưu tiên hơn dữ liệu người dùng.
- Chạy lint/typecheck; kiểm thử hồi quy phù hợp cho route guard, form/publish,
  phân trang, booking actions, chat retry và thông báo deep link khi chúng bị tác động.
- Kiểm tra API thật trên Android development build: Google, khôi phục phiên,
  refresh, mất mạng và hết hạn phiên. Test Chromium dùng fixture không thay bước này.
- Xuất bundle Android/iOS để kiểm tra asset dùng chung; iOS Liquid Glass cần bản
  cài có native module và thiết bị hỗ trợ để kiểm chứng trực quan.
- Kiểm tra kích thước bundle và độ mượt cuộn sau khi thêm minh họa. Không nạp
  trước toàn bộ ảnh trang chỉ vì chúng cùng nằm trong thư mục web.

Mỗi đợt bàn giao gồm ảnh trước/sau, màn hình đã đổi, API/hành vi được giữ,
kết quả kiểm tra và phần native chưa xác nhận. Chỉ coi redesign toàn bộ hoàn thành
khi toàn bộ route trong bảng đã được rà và các luồng chính được kiểm tra thực tế.

## Tiến độ triển khai 20/10/2026

Đã triển khai phần giao diện của cả sáu nhóm trong kế hoạch. Trạng thái này chưa
đồng nghĩa hoàn tất nghiệm thu trên thiết bị.

| Nhóm             | Code và thay đổi đã có                                                                                                                                       | Bằng chứng / phần còn thiếu                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Nền tảng         | `ArtHeader`, `ArtEmptyState`, `JourneyTicket`, `ProfileIdentity`, `FormSteps`, `InfoPanel`, `SessionLoading`; asset tham chiếu trực tiếp `web/public/images` | Lint/typecheck qua; gallery đã bổ sung component; cần kiểm tra cỡ chữ native                       |
| Chuyến đi        | Header minh họa tuyến; danh sách và chi tiết dùng vé hành trình; booking phân biệt giờ đón/trả và chi phí                                                    | Kiểm thử pickup, booking action và ảnh chụp đã có; cần thao tác nhiều tài khoản trên thiết bị      |
| Form và lịch     | Tạo chuyến ba bước, giữ lựa chọn khi quay lại; lịch chia nhóm thông tin/ngày/tuyến/xem lại; card ngày trong tuần                                             | Hồi quy publish sau lỗi không tạo trùng đã qua; cần bàn phím/safe area native                      |
| Giao tiếp        | Inbox có header minh họa và trạng thái unread; chat giữ composer riêng; thông báo dùng header icon gọn                                                       | Chat retry, deep link/read và ảnh chụp đã có; cần mạng thật và bàn phím thiết bị                   |
| Hồ sơ và an toàn | Cover phong cảnh cho hồ sơ mình/người khác; cài đặt chia nhóm; panel giải thích cho các trang con; verification/report đồng bộ                               | Hồi quy privacy, report/block qua; chưa coi eKYC hoặc server push là đã tích hợp                   |
| Vào ứng dụng     | Đăng nhập dùng nền web, phone/OTP/consent có panel ngắn; khởi động phiên có nhận diện thương hiệu                                                            | OTP, route guard, hết hạn phiên đã qua kiểm thử API fixture; cần Google login thực trên điện thoại |

Navbar giữ bốn icon không nhãn hiển thị và có accessibility label. Nhánh iOS có
Liquid Glass khi hỗ trợ, chuyển sang nền đặc khi bật Reduce Transparency. Sheet
và cuộn chat tôn trọng Reduce Motion. Các nhánh cài đặt hệ thống này cần kiểm tra
trên thiết bị, không thể kết luận chỉ từ bundle hoặc ảnh Chromium.

Lệnh kiểm tra:

```powershell
pnpm --filter @dike/mobile lint
pnpm --filter @dike/mobile typecheck
pnpm --filter @dike/mobile e2e
pnpm --filter @dike/mobile build
```

Ảnh sau thay đổi được lưu tại `apps/mobile/test-results` và sao lưu vào
`.tmp/mobile-redesign-review`; ảnh web tham chiếu trước đó tại `.tmp/mobile-reference`.
Các kiểm thử mới trong `e2e/redesign.spec.ts` kiểm tra màn hẹp/rộng, giữ dữ liệu
form và phân biệt lỗi với dữ liệu rỗng. Fixture chỉ nằm trong bộ kiểm thử, không
có chế độ demo hoặc bypass trong source chạy ứng dụng.

Kết quả gần nhất: 20 kiểm thử đã qua trong lượt hồi quy đầy đủ; sau điều chỉnh
màu chữ phụ đã chạy lại kiểm tra ảnh của các route tại 360/430 px và lint/typecheck,
đều qua. Token chữ phụ đổi sang `#526e62`, tương phản tính được 5,27:1 trên
`#f3faf7` và 5,01:1 trên `#e8f6ef`. Đây là kiểm tra các cặp màu nền đặc,
không thay việc kiểm tra tương phản chữ phủ ảnh trên thiết bị.

Bundle Hermes Android khoảng 3,2 MB, iOS khoảng 2,9 MB; cả hai xuất thành công
với ảnh từ thư mục web. Đây là JS bundle, chưa phải APK/IPA đã cài trên thiết bị.
Trang xem ảnh local: `.tmp/mobile-redesign-review/index.html` (66 ảnh).

Nghiệm thu còn lại: kết nối Android development build để thử Google/API thật,
bàn phím, cỡ chữ và TalkBack; thử iPhone hỗ trợ để kiểm tra Liquid Glass và VoiceOver.
Ngày 20/10 đã kết nối Samsung A34 qua ADB và tải giao diện từ Metro 8081;
reverse các cổng 8080/3000/8081. Redis, MongoDB và MinIO ban đầu đang tắt,
đã bật lại bằng `pnpm infra:up` và xác nhận cả ba healthy. Luồng bắt đầu đăng nhập
mobile trả 302 qua backend đến Google; người dùng xác nhận chọn tài khoản xong
đã trở về Home. Chưa coi xác nhận này là bằng chứng cho mọi API hoặc mọi trang.
Sau khi mở khóa, đã xem ảnh native của Home, Chuyến đi, Tin nhắn và Hồ sơ;
các trang hiển thị dữ liệu của phiên Google thật, không có màn lỗi API.
Ảnh lưu local tại `.tmp/mobile-native-qa/*-authenticated.png`, có thông tin
tài khoản nên không dùng làm ảnh minh họa công khai. Đã sửa cụm tiêu đề/lọc ngày
Home tự xuống dòng khi thiếu chỗ; lint, typecheck và kiểm thử Home đều qua.

QA tiếp trên A34: đóng và mở lại development build vẫn khôi phục phiên Google
và vào Home. Form hồ sơ tải dữ liệu thật, cuộn được khi mở bàn phím. Phát hiện
ô Facebook bị che một phần khi vừa focus; `DetailPage` đã bổ sung đo ô focus
sau `keyboardDidShow` và cuộn phần bị che lên, có hủy listener/timer và tôn trọng
Reduce Motion. Ảnh `profile-keyboard.png` và `profile-keyboard-after.png` xác nhận
trước/sau trên cùng thiết bị: ô cuối hiện đầy đủ trên bàn phím sau sửa.
Không nhập hoặc lưu thay đổi hồ sơ trong lượt QA này. Chưa suy rộng kết quả này
thành nghiệm thu bàn phím của chat, sheet hoặc toàn bộ form.

Sau sửa bàn phím đã chạy lại toàn bộ E2E: 20/20 qua (1,5 phút), lint/typecheck
và `git diff --check` qua. Người dùng xác nhận chỉ có Android; chưa có thiết bị
để nghiệm thu Liquid Glass/VoiceOver trên iOS. Các mục đó vẫn chưa kiểm chứng.
