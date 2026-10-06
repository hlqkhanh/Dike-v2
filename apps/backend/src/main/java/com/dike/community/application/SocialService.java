package com.dike.community.application;

import com.dike.community.SocialAccounts;
import com.dike.community.domain.SocialRelation;
import com.dike.community.domain.SocialRelation.Action;
import com.dike.community.domain.SocialRelation.Status;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SocialService {
  private final SocialStore store;
  private final SocialAccounts accounts;
  private final Clock clock;

  public SocialService(SocialStore store, SocialAccounts accounts, Clock clock) {
    this.store = store;
    this.accounts = accounts;
    this.clock = clock;
  }

  public record RelationView(
      String userId,
      String displayName,
      String status,
      String requestId,
      Instant cooldownUntil,
      boolean blockedByMe,
      long version,
      List<String> allowedActions) {}

  public record RelationPage(List<RelationView> items, String nextCursor) {}

  public record RevisionView(long revision) {}

  public RelationView relation(String actor, String target) {
    requireActor(actor);
    validateTarget(actor, target);
    var relation =
        store
            .pair(actor, target)
            .orElseGet(() -> SocialRelation.empty(actor, target, clock.instant()));
    if (!relation.blockedBy().contains(actor)
        && (!relation.blockedBy().isEmpty() || accounts.visibleName(actor, target).isEmpty()))
      throw unavailable();
    return view(actor, relation);
  }

  public RelationPage list(String actor, String kind, String cursor, int limit) {
    requireActor(actor);
    if (!List.of("friends", "incoming", "outgoing", "blocks").contains(kind)
        || limit < 1
        || limit > 50
        || (cursor != null && cursor.length() > 300)) throw invalid();
    var rows = store.list(actor, kind, cursor, limit);
    var items =
        rows.stream()
            .filter(
                r ->
                    kind.equals("blocks")
                        || (r.blockedBy().isEmpty() && accounts.active(r.other(actor))))
            .map(r -> view(actor, r))
            .toList();
    return new RelationPage(items, rows.size() == limit ? rows.getLast().id() : null);
  }

  public RevisionView revision(String actor) {
    requireActor(actor);
    return new RevisionView(store.revision(actor));
  }

  public RelationView command(
      String actor, Action action, String target, String requestId, String key) {
    requireActor(actor);
    if (key == null || !key.matches("[A-Za-z0-9_-]{8,100}")) throw invalid();
    if (target != null) validateTarget(actor, target);
    if (requestId != null && !requestId.matches("[A-Za-z0-9-]{1,100}")) throw invalid();
    String fingerprint = action.name() + ":" + (target == null ? requestId : target);
    try {
      return store.transaction(
          () -> {
            var existing = target == null ? store.invitation(requestId) : store.pair(actor, target);
            SocialRelation before =
                existing.orElseGet(
                    () -> {
                      if (target == null) throw unavailable();
                      return SocialRelation.empty(actor, target, clock.instant());
                    });
            if (!before.involves(actor)) throw unavailable();
            String other = before.other(actor);
            if (action == Action.BLOCK && !accounts.active(other)) throw unavailable();
            var receipt = store.receipt(actor, key);
            if (receipt.isPresent()) {
              if (!receipt.get().equals(fingerprint)) throw conflict("IDEMPOTENCY_CONFLICT");
              if (!before.blockedBy().isEmpty() && !before.blockedBy().contains(actor))
                throw unavailable();
              return view(actor, before);
            }
            if ((action == Action.SEND || action == Action.ACCEPT) && !accounts.active(other))
              throw unavailable();
            if (action == Action.SEND && accounts.visibleName(actor, other).isEmpty())
              throw unavailable();
            // Blocking uses a known active account ID without returning private profile fields.
            var after =
                before.apply(
                    action,
                    actor,
                    action == Action.SEND ? UUID.randomUUID().toString() : requestId,
                    clock.instant());
            if (after != before) {
              if (action == Action.SEND) store.acquireSendQuota(actor, clock.instant());
              store.save(before, after, actor, action.name());
            }
            store.receipt(actor, key, fingerprint, before.id(), clock.instant());
            return view(actor, after);
          });
    } catch (SocialRelation.Rejected rejected) {
      if (rejected.getMessage().equals("RESOURCE_NOT_AVAILABLE")) throw unavailable();
      if (rejected.getMessage().equals("SOCIAL_INVALID_TARGET")) throw invalid();
      throw conflict(rejected.getMessage());
    }
  }

  private RelationView view(String actor, SocialRelation r) {
    boolean ownBlock = r.blockedBy().contains(actor);
    String other = r.other(actor);
    if (!ownBlock && !r.blockedBy().isEmpty()) {
      return new RelationView(
          other, "Người dùng", "NONE", null, null, false, r.version(), List.of("BLOCK"));
    }
    List<String> actions = new ArrayList<>();
    if (ownBlock) actions.add("UNBLOCK");
    else if (r.blockedBy().isEmpty()) {
      actions.add("BLOCK");
      if (r.status() == Status.ACCEPTED) actions.add("REMOVE");
      else if (r.status() == Status.PENDING) {
        if (actor.equals(r.requester())) actions.add("CANCEL");
        else {
          actions.add("ACCEPT");
          actions.add("DECLINE");
        }
      } else if (r.cooldownUntil() == null || !clock.instant().isBefore(r.cooldownUntil()))
        actions.add("SEND");
    }
    return new RelationView(
        other,
        ownBlock || !r.blockedBy().isEmpty()
            ? "Người dùng"
            : accounts.visibleName(actor, other).orElse("Người dùng"),
        ownBlock
            ? "BLOCKED"
            : r.status() == Status.PENDING
                ? (actor.equals(r.requester()) ? "OUTGOING" : "INCOMING")
                : r.status().name(),
        ownBlock ? null : r.requestId(),
        ownBlock ? null : r.cooldownUntil(),
        ownBlock,
        r.version(),
        List.copyOf(actions));
  }

  private void requireActor(String actor) {
    if (actor == null || !accounts.active(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "SOCIAL_ACCOUNT_UNAVAILABLE", "Tài khoản không khả dụng");
  }

  private void validateTarget(String actor, String target) {
    if (target == null || !target.matches("[A-Za-z0-9_-]{1,100}") || actor.equals(target))
      throw invalid();
  }

  private ApiException invalid() {
    return new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY, "SOCIAL_INVALID_REQUEST", "Yêu cầu không hợp lệ");
  }

  private ApiException unavailable() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy nội dung");
  }

  private ApiException conflict(String code) {
    return new ApiException(
        HttpStatus.CONFLICT,
        code,
        code.equals("FRIENDSHIP_COOLDOWN")
            ? "Vui lòng chờ đủ 7 ngày từ lần từ chối hoặc hủy kết bạn"
            : "Trạng thái đã thay đổi, vui lòng tải lại");
  }
}
