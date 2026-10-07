package com.dike.trust.application;

import com.dike.planning.PostAccess;
import com.dike.planning.PostAccounts;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import java.time.Clock;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class PostReportService {
  public interface Store {
    long recent(String reporter, java.time.Instant since);

    void insert(
        String id, String reporter, String post, String reason, String note, java.time.Instant now);
  }

  public record Input(String postId, String reason, String note) {}

  public record Receipt(String id, String status) {}

  private final Store store;
  private final PostAccess posts;
  private final PostAccounts accounts;
  private final AtomicCommands commands;
  private final Clock clock;

  public PostReportService(
      Store store, PostAccess posts, PostAccounts accounts, AtomicCommands commands, Clock clock) {
    this.store = store;
    this.posts = posts;
    this.accounts = accounts;
    this.commands = commands;
    this.clock = clock;
  }

  public Receipt report(String actor, Input input, String key) {
    if (!accounts.active(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "ACCOUNT_UNAVAILABLE", "Tài khoản không khả dụng");
    if (input.reason() == null
        || !Set.of("SPAM", "UNSAFE", "MISLEADING", "OTHER").contains(input.reason())
        || input.note() == null
        || input.note().length() > 1000)
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REPORT", "Nội dung báo cáo không hợp lệ");
    String id =
        commands.execute(
            actor,
            "post.report",
            key,
            input.toString(),
            () -> {
              posts.requireReadable(actor, input.postId());
              commands.fence("reports", actor);
              if (store.recent(actor, clock.instant().minusSeconds(3600)) >= 10)
                throw new ApiException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "REPORT_RATE_LIMITED",
                    "Bạn đã gửi nhiều báo cáo, vui lòng thử lại sau");
              String report = UUID.randomUUID().toString();
              store.insert(
                  report, actor, input.postId(), input.reason(), input.note(), clock.instant());
              return report;
            });
    return new Receipt(id, "RECEIVED");
  }
}
