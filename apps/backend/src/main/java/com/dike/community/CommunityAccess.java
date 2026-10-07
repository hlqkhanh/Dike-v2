package com.dike.community;

/** Stage 5 adapter must fence membership changes against acceptance before enabling communities. */
public interface CommunityAccess {
  boolean member(String userId, String communityId);

  /** Join the acceptance transaction and conflict with membership revocation. */
  default void fence(String userId, String communityId) {
    throw new com.dike.shared.api.ApiException(
        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
        "MEMBERSHIP_GUARD_UNAVAILABLE",
        "Chưa thể kiểm tra quyền cộng đồng");
  }
}
