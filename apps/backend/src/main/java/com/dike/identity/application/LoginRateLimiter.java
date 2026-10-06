package com.dike.identity.application;

public interface LoginRateLimiter {

  boolean tryAcquireLogin(String clientAddress);

  boolean tryAcquireFailure(String clientAddress);
}
