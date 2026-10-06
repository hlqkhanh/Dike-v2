package com.dike.identity.application;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;

public record DikePrincipal(String userId, long authorizationVersion)
    implements Principal, Serializable {

  @Serial private static final long serialVersionUID = 1L;

  public DikePrincipal(String userId) {
    this(userId, 0);
  }

  @Override
  public String getName() {
    return userId;
  }
}
