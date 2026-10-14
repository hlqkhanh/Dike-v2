package com.dike.identity.api;

import com.dike.identity.api.ProfileRequests.ConsentDecisionRequest;
import com.dike.identity.api.ProfileRequests.UpdatePrivacy;
import com.dike.identity.api.ProfileRequests.UpdateProfile;
import com.dike.identity.api.ProfileResponses.ConsentReceiptResponse;
import com.dike.identity.api.ProfileResponses.ConsentSummaryResponse;
import com.dike.identity.api.ProfileResponses.DeletionResponse;
import com.dike.identity.api.ProfileResponses.MyProfileResponse;
import com.dike.identity.api.ProfileResponses.PrivacyResponse;
import com.dike.identity.api.ProfileResponses.ProfileSearchResponse;
import com.dike.identity.api.ProfileResponses.PublicProfileResponse;
import com.dike.identity.application.AccountDeletionService;
import com.dike.identity.application.ConsentService;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.ProfileRateLimiter;
import com.dike.identity.application.ProfileService;
import com.dike.identity.application.SessionApplicationService;
import com.dike.identity.infrastructure.security.SessionAttributes;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "sessionCookie")
public class ProfileController {
  private final ProfileService profiles;
  private final ConsentService consents;
  private final AccountDeletionService deletions;
  private final SessionApplicationService sessions;
  private final ProfileRateLimiter rateLimiter;

  public ProfileController(
      ProfileService profiles,
      ConsentService consents,
      AccountDeletionService deletions,
      SessionApplicationService sessions,
      ProfileRateLimiter rateLimiter) {
    this.profiles = profiles;
    this.consents = consents;
    this.deletions = deletions;
    this.sessions = sessions;
    this.rateLimiter = rateLimiter;
  }

  @GetMapping("/me/profile")
  @Operation(operationId = "getMyProfile")
  MyProfileResponse me(@AuthenticationPrincipal DikePrincipal principal) {
    var bundle = profiles.me(principal.userId());
    return MyProfileResponse.from(bundle.profile(), bundle.account());
  }

  @PatchMapping("/me/profile")
  MyProfileResponse updateProfile(
      @AuthenticationPrincipal DikePrincipal principal, @Valid @RequestBody UpdateProfile body) {
    try {
      var updated =
          profiles.updateProfile(
              principal.userId(), body.displayName(), body.bio(), body.dateOfBirth(),
              body.provinceCode(), body.localityCode(), body.localityName(), body.facebookUrl(),
              body.expectedVersion());
      return MyProfileResponse.from(updated, profiles.me(principal.userId()).account());
    } catch (ProfileService.VersionConflictException exception) {
      throw new ApiException(
          HttpStatus.CONFLICT, "PROFILE_VERSION_CONFLICT", "Hồ sơ đã thay đổi, vui lòng tải lại");
    } catch (ProfileService.InvalidProfileException exception) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "PROFILE_INVALID", "Thông tin hồ sơ không hợp lệ");
    }
  }

  @GetMapping("/users/{userId}")
  PublicProfileResponse profile(
      @AuthenticationPrincipal DikePrincipal principal, @PathVariable String userId) {
    try {
      return PublicProfileResponse.from(profiles.view(principal.userId(), userId));
    } catch (ProfileService.NotVisibleException exception) {
      throw new ApiException(HttpStatus.NOT_FOUND, "PROFILE_NOT_VISIBLE", "Không tìm thấy hồ sơ");
    }
  }

  @GetMapping("/users")
  ProfileSearchResponse search(
      @AuthenticationPrincipal DikePrincipal principal,
      @RequestParam String query,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit,
      HttpServletRequest request) {
    if (!rateLimiter.tryAcquire(
        "profile-search",
        principal.userId(),
        request.getRemoteAddr(),
        1,
        60,
        Duration.ofMinutes(1))) {
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "PROFILE_RATE_LIMITED",
          "Đã có quá nhiều yêu cầu tìm kiếm",
          Duration.ofMinutes(1));
    }
    List<PublicProfileResponse> items =
        profiles.search(principal.userId(), query, cursor, limit).stream()
            .map(PublicProfileResponse::from)
            .toList();
    String next =
        items.size() == Math.min(Math.max(limit, 1), 20)
            ? items.get(items.size() - 1).userId()
            : null;
    return new ProfileSearchResponse(items, next);
  }

  @GetMapping("/me/privacy")
  PrivacyResponse privacy(@AuthenticationPrincipal DikePrincipal principal) {
    return PrivacyResponse.from(profiles.me(principal.userId()).privacy());
  }

  @PatchMapping("/me/privacy")
  PrivacyResponse updatePrivacy(
      @AuthenticationPrincipal DikePrincipal principal, @Valid @RequestBody UpdatePrivacy body) {
    try {
      return PrivacyResponse.from(
          profiles.updatePrivacy(
              principal.userId(),
              body.profileVisibility(),
              body.discoverableByName(),
              body.allowMessageRequests(),
              body.expectedVersion()));
    } catch (ProfileService.PrivacyVersionConflictException exception) {
      throw new ApiException(
          HttpStatus.CONFLICT, "PRIVACY_VERSION_CONFLICT", "Thiết lập quyền riêng tư đã thay đổi");
    }
  }

  @GetMapping("/me/consents")
  ConsentSummaryResponse consentSummary(@AuthenticationPrincipal DikePrincipal principal) {
    var summary = consents.summary(principal.userId());
    return new ConsentSummaryResponse(
        summary.requirements().stream()
            .map(ProfileResponses.ConsentRequirementResponse::from)
            .toList(),
        summary.receipts().stream().map(ConsentReceiptResponse::from).toList());
  }

  @PostMapping("/me/consents")
  ConsentReceiptResponse consent(
      @AuthenticationPrincipal DikePrincipal principal,
      @Valid @RequestBody ConsentDecisionRequest body) {
    try {
      return ConsentReceiptResponse.from(
          consents.decide(principal.userId(), body.consentType(), body.decision(), body.locale()));
    } catch (ConsentService.UnsupportedWithdrawalException exception) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "CONSENT_VERSION_INVALID",
          "Phiên bản hiện tại chưa hỗ trợ rút loại đồng ý này");
    }
  }

  @GetMapping("/me/deletion-request")
  ResponseEntity<DeletionResponse> deletionStatus(
      @AuthenticationPrincipal DikePrincipal principal) {
    DeletionResponse response = DeletionResponse.from(deletions.status(principal.userId()));
    return response == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(response);
  }

  @PostMapping("/me/deletion-requests")
  ResponseEntity<DeletionResponse> requestDeletion(
      @AuthenticationPrincipal DikePrincipal principal,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      HttpServletRequest request) {
    try {
      Instant authenticatedAt =
          (Instant) request.getSession().getAttribute(SessionAttributes.GOOGLE_AUTHENTICATED_AT);
      var deletion = deletions.request(principal.userId(), authenticatedAt, idempotencyKey);
      DeletionResponse response = DeletionResponse.from(deletion);
      sessions.logoutAll(principal, request);
      return ResponseEntity.accepted().body(response);
    } catch (AccountDeletionService.ReauthenticationRequiredException exception) {
      throw new ApiException(
          HttpStatus.FORBIDDEN,
          "ACCOUNT_DELETION_REAUTH_REQUIRED",
          "Bạn cần đăng nhập lại bằng Google trước khi yêu cầu xóa");
    } catch (AccountDeletionService.InvalidRequestException exception) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY", "Idempotency key không hợp lệ");
    }
  }
}
