package com.dike.community.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** One aggregate serializes friendship and both directional blocks. */
public record SocialRelation(
    String id,
    String low,
    String high,
    Status status,
    String requester,
    String requestId,
    Instant cooldownUntil,
    Set<String> blockedBy,
    long version,
    Instant updatedAt) {
  public enum Status {
    NONE,
    PENDING,
    ACCEPTED,
    DECLINED,
    CANCELLED,
    REMOVED
  }

  public enum Action {
    SEND,
    ACCEPT,
    DECLINE,
    CANCEL,
    REMOVE,
    BLOCK,
    UNBLOCK
  }

  public SocialRelation {
    blockedBy = Set.copyOf(blockedBy);
  }

  public static SocialRelation empty(String a, String b, Instant now) {
    if (a == null || b == null || a.equals(b) || a.isBlank() || b.isBlank()) {
      throw new Rejected("SOCIAL_INVALID_TARGET");
    }
    String low = a.compareTo(b) < 0 ? a : b;
    String high = a.compareTo(b) < 0 ? b : a;
    return new SocialRelation(
        low.length() + ":" + low + high,
        low,
        high,
        Status.NONE,
        null,
        null,
        null,
        Set.of(),
        0,
        now);
  }

  public boolean involves(String actor) {
    return low.equals(actor) || high.equals(actor);
  }

  public String other(String actor) {
    if (!involves(actor)) throw new Rejected("RESOURCE_NOT_AVAILABLE");
    return low.equals(actor) ? high : low;
  }

  public boolean friends() {
    return status == Status.ACCEPTED && blockedBy.isEmpty();
  }

  public SocialRelation apply(Action action, String actor, String invitation, Instant now) {
    if (!involves(actor)) throw new Rejected("RESOURCE_NOT_AVAILABLE");
    var blocks = new HashSet<>(blockedBy);
    Status next = status;
    String sender = requester;
    String request = requestId;
    Instant cooldown = cooldownUntil;
    if (action == Action.BLOCK) {
      if (!blocks.add(actor)) return this;
      if (status == Status.ACCEPTED) {
        next = Status.REMOVED;
        cooldown = now.plus(Duration.ofDays(7));
      } else if (status == Status.PENDING) next = Status.CANCELLED;
    } else if (action == Action.UNBLOCK) {
      if (!blocks.remove(actor)) return this;
    } else {
      if (!blocks.isEmpty()) throw new Rejected("RESOURCE_NOT_AVAILABLE");
      switch (action) {
        case SEND -> {
          if (status == Status.PENDING || status == Status.ACCEPTED) return this;
          if (cooldown != null && now.isBefore(cooldown)) {
            throw new Rejected("FRIENDSHIP_COOLDOWN");
          }
          next = Status.PENDING;
          sender = actor;
          request = invitation;
        }
        case ACCEPT, DECLINE, CANCEL -> {
          if (status != Status.PENDING || !java.util.Objects.equals(requestId, invitation)) {
            throw new Rejected("SOCIAL_STATE_CONFLICT");
          }
          if ((action == Action.CANCEL) != actor.equals(requester)) {
            throw new Rejected("RESOURCE_NOT_AVAILABLE");
          }
          next =
              action == Action.ACCEPT
                  ? Status.ACCEPTED
                  : action == Action.DECLINE ? Status.DECLINED : Status.CANCELLED;
          if (action == Action.DECLINE) cooldown = now.plus(Duration.ofDays(7));
        }
        case REMOVE -> {
          if (status == Status.REMOVED) return this;
          if (status != Status.ACCEPTED) throw new Rejected("SOCIAL_STATE_CONFLICT");
          next = Status.REMOVED;
          cooldown = now.plus(Duration.ofDays(7));
        }
        default -> throw new IllegalStateException("Unsupported action");
      }
    }
    return new SocialRelation(
        id, low, high, next, sender, request, cooldown, blocks, version + 1, now);
  }

  public static final class Rejected extends RuntimeException {
    public Rejected(String code) {
      super(code);
    }
  }
}
