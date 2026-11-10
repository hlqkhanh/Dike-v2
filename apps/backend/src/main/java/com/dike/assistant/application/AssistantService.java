package com.dike.assistant.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.AssistantPlanning;
import com.dike.ride.AssistantBookings;
import com.dike.shared.api.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AssistantService {
  public static final Set<String> FIELD_NAMES =
      Set.of(
          "originQuery",
          "destinationQuery",
          "date",
          "until",
          "departureTime",
          "arrivalTime",
          "startTime",
          "endTime",
          "weekdays",
          "directions",
          "role",
          "category",
          "name",
          "buffer",
          "seats");

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantDraft")
  public record Draft(String id, String kind, long version, Map<String, String> fields) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantConversation")
  public record Conversation(
      String id,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true) Draft draft,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
          AssistantPlanning.Result saved) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantReply")
  public record Reply(
      String text,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true) Draft draft,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
          AssistantKnowledge.Article source,
      List<AssistantBookings.Card> bookings,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true) String checkedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantConfirmation")
  public record Confirmation(
      long version,
      Map<String, String> fields,
      String originPlaceRef,
      String destinationPlaceRef) {}

  private final AssistantStore store;
  private final AiGateway ai;
  private final IdentityAccess identity;
  private final AssistantPlanning planning;
  private final AssistantBookings bookings;
  private final ObjectMapper json;
  private final Clock clock;

  public AssistantService(
      AssistantStore store,
      AiGateway ai,
      IdentityAccess identity,
      AssistantPlanning planning,
      AssistantBookings bookings,
      ObjectMapper json,
      Clock clock) {
    this.store = store;
    this.ai = ai;
    this.identity = identity;
    this.planning = planning;
    this.bookings = bookings;
    this.json = json;
    this.clock = clock;
  }

  public Conversation create(String actor) {
    identity.require(actor);
    store.acquire(actor);
    var value = new Conversation(UUID.randomUUID().toString(), null, null);
    save(actor, value);
    return value;
  }

  public Conversation get(String actor, String id) {
    identity.require(actor);
    validId(id);
    String value = store.read(actor, id);
    if (value == null)
      throw new ApiException(
          HttpStatus.NOT_FOUND,
          "ASSISTANT_CONVERSATION_EXPIRED",
          "Hội thoại không tồn tại hoặc đã hết hạn. Hãy bắt đầu hội thoại mới.");
    try {
      return json.readValue(value, Conversation.class);
    } catch (Exception e) {
      throw new IllegalStateException("Invalid assistant state", e);
    }
  }

  public void delete(String actor, String id) {
    locked(
        actor,
        id,
        () -> {
          get(actor, id);
          store.delete(actor, id);
          return true;
        });
  }

  public Reply message(String actor, String id, String text) {
    return message(actor, id, text, null, null);
  }

  public Reply message(
      String actor, String id, String text, Long draftVersion, Map<String, String> editedFields) {
    if (text == null || text.isBlank() || text.length() > 2000)
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "ASSISTANT_INVALID_MESSAGE", "Nhập từ 1 đến 2.000 ký tự.");
    store.acquire(actor);
    return locked(
        actor,
        id,
        () -> {
          var conversation = get(actor, id);
          if (editedFields != null) {
            var previous = conversation.draft();
            if (previous == null
                || conversation.saved() != null
                || draftVersion == null
                || previous.version() != draftVersion)
              throw new ApiException(
                  HttpStatus.CONFLICT,
                  "ASSISTANT_DRAFT_CHANGED",
                  "Bản nháp đã thay đổi. Hãy bắt đầu lại hội thoại.");
            var synced = clean(editedFields);
            if (!synced.equals(previous.fields())) {
              conversation =
                  new Conversation(
                      id,
                      new Draft(previous.id(), previous.kind(), previous.version() + 1, synced),
                      null);
            }
          }
          var draft = conversation.draft();
          // Reviewed shortcuts keep help and booking reads available even with AI disabled.
          if (text.equals("Xem booking của tôi")) {
            var reply = bookingReply(actor, draft);
            save(actor, conversation);
            return reply;
          }
          for (var article : AssistantKnowledge.ARTICLES) {
            if (text.equals("Hướng dẫn: " + article.title())) {
              save(actor, conversation);
              return new Reply(article.text(), draft, article, List.of(), null);
            }
          }
          if (text.equals("Bỏ bản nháp")) {
            save(actor, new Conversation(id, null, null));
            return new Reply(
                "Đã bỏ bản nháp. Bạn muốn tạo nhu cầu hay lịch định kỳ mới?",
                null,
                null,
                List.of(),
                null);
          }
          var guide = AssistantKnowledge.creationGuide(text);
          if (guide != null) {
            save(actor, conversation);
            return new Reply(guide.text(), draft, guide, List.of(), null);
          }
          store.acquireAi();
          var result =
              ai.extract(
                  text,
                  LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh"))).toString(),
                  draft == null || conversation.saved() != null ? "NONE" : draft.kind(),
                  draft == null || conversation.saved() != null ? Map.of() : draft.fields());
          return switch (result.action()) {
            case "HELP" -> {
              var article = AssistantKnowledge.find(result.helpTopic());
              String answer = result.answer();
              if (answer == null || answer.isBlank() || answer.length() > 1800)
                answer = article.text();
              save(actor, conversation);
              yield new Reply(answer.strip(), draft, article, List.of(), null);
            }
            case "BOOKINGS" -> {
              var reply = bookingReply(actor, draft, clean(result.fields()).get("date"));
              save(actor, conversation);
              yield reply;
            }
            case "INTENT", "SCHEDULE" -> {
              var fields = clean(result.fields());
              boolean same =
                  draft != null
                      && conversation.saved() == null
                      && draft.kind().equals(result.action());
              var merged = new LinkedHashMap<String, String>();
              if (same) merged.putAll(draft.fields());
              merged.putAll(fields);
              if (result.action().equals("SCHEDULE")) merged.putIfAbsent("buffer", "10");
              var next =
                  new Draft(
                      same ? draft.id() : UUID.randomUUID().toString(),
                      result.action(),
                      draft == null ? 1 : draft.version() + 1,
                      Map.copyOf(merged));
              save(actor, new Conversation(id, next, null));
              var missing = missing(next.kind(), next.fields());
              String response =
                  missing.isEmpty()
                      ? "Mình đã điền bản nháp. Hãy chọn hai địa chỉ chính xác, kiểm tra giờ và bấm Xác nhận lưu."
                      : "Mình cần thêm: "
                          + String.join(", ", missing)
                          + ". Bạn có thể trả lời tiếp hoặc sửa các ô trong bản nháp."
                          + (merged.containsKey("originQuery")
                                  && merged.containsKey("destinationQuery")
                              ? " Đã nhận tên nơi đi/đến; hãy chọn địa chỉ chính xác trong bản nháp."
                              : "");
              yield new Reply(response, next, null, List.of(), null);
            }
            default ->
                throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "ASSISTANT_INVALID_OUTPUT",
                    "AI trả kết quả chưa hợp lệ. Hãy thử diễn đạt lại.");
          };
        });
  }

  public AssistantPlanning.Result confirm(String actor, String id, Confirmation input) {
    return locked(
        actor,
        id,
        () -> {
          var state = get(actor, id);
          if (state.saved() != null) return state.saved();
          var draft = state.draft();
          if (draft == null || draft.version() != input.version())
            throw new ApiException(
                HttpStatus.CONFLICT,
                "ASSISTANT_DRAFT_CHANGED",
                "Bản nháp đã thay đổi. Hãy kiểm tra lại.");
          var fields = clean(input.fields());
          if (!missing(draft.kind(), fields).isEmpty())
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "ASSISTANT_INCOMPLETE_DRAFT",
                "Vui lòng điền đầy đủ các trường trong bản nháp.");
          if (input.originPlaceRef() == null
              || input.destinationPlaceRef() == null
              || !input.originPlaceRef().matches("[A-Za-z0-9_-]{8,100}")
              || !input.destinationPlaceRef().matches("[A-Za-z0-9_-]{8,100}"))
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "ASSISTANT_PLACES_REQUIRED",
                "Hãy chọn hai địa chỉ từ danh sách gợi ý.");
          var result =
              planning.confirm(
                  actor,
                  draft.id(),
                  draft.kind(),
                  fields,
                  input.originPlaceRef(),
                  input.destinationPlaceRef());
          save(actor, new Conversation(id, draft, result));
          return result;
        });
  }

  static Map<String, String> clean(Map<String, String> fields) {
    if (fields == null || fields.size() > FIELD_NAMES.size()) throw invalidFields();
    var result = new LinkedHashMap<String, String>();
    fields.forEach(
        (key, value) -> {
          if (!FIELD_NAMES.contains(key) || value == null || value.length() > 200)
            throw invalidFields();
          if (!value.isBlank()) result.put(key, value.strip());
        });
    return result;
  }

  static List<String> missing(String kind, Map<String, String> f) {
    var required = new LinkedHashMap<String, String>();
    required.put("originQuery", "nơi xuất phát");
    required.put("destinationQuery", "nơi đến");
    required.put("date", "ngày áp dụng");
    required.put("role", "vai trò đi ké hoặc tài xế");
    if (kind.equals("SCHEDULE")) {
      required.put("name", "tên lịch");
      required.put("until", "ngày kết thúc");
      required.put("weekdays", "ngày lặp trong tuần");
      required.put("startTime", "giờ bắt đầu học/làm");
      required.put("endTime", "giờ kết thúc học/làm");
      required.put("category", "loại hoạt động");
      required.put("directions", "chiều đi/về");
    } else {
      required.put("departureTime", "giờ xuất phát");
      required.put("arrivalTime", "hạn đến nơi");
    }
    return required.entrySet().stream()
        .filter(e -> !f.containsKey(e.getKey()) || f.get(e.getKey()).isBlank())
        .map(Map.Entry::getValue)
        .toList();
  }

  private Reply bookingReply(String actor, Draft draft) {
    return bookingReply(actor, draft, null);
  }

  private Reply bookingReply(String actor, Draft draft, String date) {
    var items = bookings.mine(actor);
    if (date != null && !date.isBlank()) {
      try {
        LocalDate day = LocalDate.parse(date);
        items =
            items.stream()
                .filter(
                    b ->
                        b.pickupAt() != null
                            && b.pickupAt()
                                .atZone(ZoneId.of("Asia/Ho_Chi_Minh"))
                                .toLocalDate()
                                .equals(day))
                .toList();
      } catch (java.time.format.DateTimeParseException e) {
        throw new ApiException(
            HttpStatus.BAD_REQUEST,
            "ASSISTANT_INVALID_DATE",
            "Chưa hiểu ngày cần tra cứu. Hãy nhập ngày cụ thể.");
      }
    }
    return new Reply(
        "Đây là tối đa 20 booking gần nhất bạn được phép xem. Mở chi tiết để thao tác; trạng thái có thể thay đổi sau thời điểm tra cứu.",
        draft,
        null,
        items,
        clock.instant().toString());
  }

  private void save(String actor, Conversation value) {
    try {
      store.save(actor, value.id(), json.writeValueAsString(value));
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private <T> T locked(String actor, String id, Supplier<T> operation) {
    identity.require(actor);
    validId(id);
    String token = UUID.randomUUID().toString();
    if (!store.lock(actor, id, token))
      throw new ApiException(
          HttpStatus.CONFLICT, "ASSISTANT_BUSY", "Đang xử lý yêu cầu trước. Hãy chờ một chút.");
    try {
      return operation.get();
    } finally {
      store.unlock(actor, id, token);
    }
  }

  private static void validId(String id) {
    if (id == null || !id.matches("[A-Za-z0-9_-]{8,100}")) throw invalidFields();
  }

  private static ApiException invalidFields() {
    return new ApiException(
        HttpStatus.BAD_REQUEST, "ASSISTANT_INVALID_FIELDS", "Dữ liệu bản nháp không hợp lệ.");
  }
}
