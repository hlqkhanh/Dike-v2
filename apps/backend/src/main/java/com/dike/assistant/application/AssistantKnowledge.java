package com.dike.assistant.application;

import java.util.List;

/** Reviewed facts ground answers; navigation targets always come from these articles. */
public final class AssistantKnowledge {
  private AssistantKnowledge() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantHelpArticle")
  public record Article(String id, String title, String text, String action) {}

  public static final List<Article> ARTICLES =
      List.of(
          new Article(
              "about-v1",
              "Dike là gì?",
              "Dike (Diké Share) là nền tảng kết nối người có xe với người cần đi ké hoặc đi chung xe theo tuyến đường và thời gian phù hợp. Người dùng có thể tạo nhu cầu một lần, lịch đi học/đi làm định kỳ, tìm bài đăng phù hợp, gửi đề nghị đi cùng và theo dõi booking khi hai bên chấp nhận. Dike có nhắn tin, đánh giá và báo cáo vấn đề để hỗ trợ phối hợp chuyến đi. Chi phí đóng góp được hiển thị trong luồng chuyến đi; không có thông tin khẳng định mọi chuyến đều miễn phí hay tài xế luôn sẵn ngay.",
              "RIDES"),
          new Article(
              "trip-v1",
              "Tạo chuyến đi Tôi chở",
              "Để tạo chuyến bạn chở: mở Tạo chuyến, chọn Tôi chở (Có chỗ trống), chọn điểm đi và điểm đến chính xác, nhập ngày giờ khởi hành, phương tiện và số chỗ trống. Xem lại tuyến đường và thông tin trước khi xác nhận đăng chuyến. Nếu ứng dụng yêu cầu quyền tài xế, hoàn tất điều kiện được hiển thị. Tạo lịch định kỳ dành cho lịch học/làm lặp lại; lưu lịch qua trợ lý chưa đăng chuyến hoặc tạo booking.",
              "RIDES"),
          new Article(
              "schedule-v1",
              "Tạo lịch định kỳ",
              "Mở Lịch trình, chọn tạo lịch, nhập nơi xuất phát và nơi học/làm, ngày lặp, giờ bắt đầu/kết thúc hoạt động, chiều đi/về và quyền hiển thị. Bạn cũng có thể mô tả lịch tại đây, kiểm tra bản nháp và bấm Xác nhận lưu. Lưu lịch chưa tạo booking.",
              "SCHEDULES"),
          new Article(
              "booking-v1",
              "Đặt chỗ đi cùng",
              "Tìm bài đăng còn mở, kiểm tra tuyến đường, giờ đi và chỗ trống. Chọn điểm đón/trả rồi gửi yêu cầu hoặc đề nghị đi cùng. Theo dõi phản hồi trong chi tiết yêu cầu; chỉ khi luồng chấp nhận hoàn tất mới có booking.",
              "RIDES"),
          new Article(
              "cancel-v1",
              "Hủy chuyến hoặc booking",
              "Mở Chuyến của tôi, chọn chuyến hoặc booking cần xử lý. Nếu trạng thái hiện tại cho phép, chọn Hủy và kiểm tra lý do trước khi xác nhận. Nếu không thấy thao tác Hủy, xem trạng thái tại trang chi tiết. Trợ lý không tự hủy thay bạn.",
              "BOOKINGS"),
          new Article(
              "report-v1",
              "Báo cáo vấn đề",
              "Mở chi tiết bài đăng hoặc hồ sơ liên quan, chọn Báo cáo, chọn lý do và mô tả sự việc. Gửi qua hộp báo cáo của ứng dụng; câu nhắn cho trợ lý chưa phải báo cáo đã gửi.",
              "RIDES"),
          new Article(
              "privacy-v1",
              "Quyền riêng tư",
              "Người dùng quản lý quyền xem hồ sơ, khả năng tìm kiếm và lời mời nhắn tin trong Cài đặt quyền riêng tư. Lịch được tạo qua trợ lý được lưu riêng tư. Việc chia sẻ vị trí trực tiếp cần sự đồng ý theo luồng booking. Trợ lý chỉ được tra booking mà tài khoản hiện tại có quyền xem và không tự đặt hoặc hủy chỗ.",
              "NONE"),
          new Article(
              "verification-v1",
              "Xác minh tài khoản",
              "Dike có luồng xác minh số điện thoại và kiểm tra quyền tài xế. eKYC và duyệt giấy tờ thật hiện đang tạm hoãn. Môi trường local có tài khoản và quyền tài xế thử nghiệm để kiểm thử; trạng thái thử nghiệm không phải xác minh danh tính thật. Không khẳng định mọi người dùng hoặc tài xế đều đã được xác minh.",
              "NONE"),
          new Article(
              "assistant-v1",
              "Trợ lý Dike",
              "Mình hỗ trợ tạo nhu cầu một lần, lịch định kỳ và hướng dẫn sử dụng Dike. Hãy nói địa điểm, ngày, giờ và vai trò đi ké/tài xế. Với lịch định kỳ, cần ngày lặp và giờ bắt đầu/kết thúc học hoặc làm. Bạn luôn được xem và xác nhận trước khi lưu.",
              "NONE"));

  public static Article find(String topic) {
    return ARTICLES.stream()
        .filter(a -> a.id().startsWith(topic + "-"))
        .findFirst()
        .orElse(ARTICLES.getLast());
  }

  /** Explicit how-to questions must never become a draft, even if the model misclassifies. */
  public static Article creationGuide(String text) {
    String normalized =
        java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .toLowerCase(java.util.Locale.ROOT)
            .replaceAll("\\s+", " ")
            .strip();
    boolean asking =
        normalized.matches(".*\\b(cach|huong dan|lam sao|lam the nao|nhu the nao)\\b.*");
    boolean creating = normalized.matches(".*\\b(tao|dang|lap)\\b.*");
    if (!asking || !creating) return null;
    if (normalized.contains("dinh ky") || normalized.contains("lich")) return find("schedule");
    if (normalized.contains("toi cho") || normalized.contains("tai xe")) return find("trip");
    return null;
  }
}
