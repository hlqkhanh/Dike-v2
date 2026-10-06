package com.dike.identity.application;

import java.io.Serial;
import java.io.Serializable;
import java.security.Principal;

public record DikePrincipal(String userId) implements Principal, Serializable {

  @Serial private static final long serialVersionUID = 1L;

  @Override
  public String getName() {
    return userId;
  }
}
