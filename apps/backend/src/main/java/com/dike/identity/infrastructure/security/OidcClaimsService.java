package com.dike.identity.infrastructure.security;

import java.util.Objects;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

final class OidcClaimsService extends OidcUserService {

  private final IdentityProperties properties;

  OidcClaimsService(IdentityProperties properties) {
    this.properties = properties;
  }

  @Override
  public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
    OidcUser user = super.loadUser(userRequest);
    boolean verified = Boolean.TRUE.equals(user.getEmailVerified());
    boolean issuerMatches =
        user.getIssuer() != null
            && Objects.equals(user.getIssuer().toString(), properties.google().issuer());
    if (!verified || !issuerMatches || user.getSubject() == null || user.getEmail() == null) {
      throw new OAuth2AuthenticationException(
          new OAuth2Error("OIDC_CLAIM_INVALID"), "Required Google claims are invalid");
    }
    return user;
  }
}
