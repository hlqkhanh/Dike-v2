package com.dike.identity.infrastructure.security;

public final class SessionAttributes {

  public static final String HANDLE = "dike.session.handle";
  public static final String CREATED_AT = "dike.session.createdAt";
  public static final String LAST_SEEN_AT = "dike.session.lastSeenAt";
  public static final String ABSOLUTE_EXPIRES_AT = "dike.session.absoluteExpiresAt";
  public static final String DEVICE_LABEL = "dike.session.deviceLabel";
  public static final String ACCOUNT_ID = "dike.session.accountId";
  public static final String GOOGLE_AUTHENTICATED_AT = "dike.session.googleAuthenticatedAt";

  private SessionAttributes() {}
}
