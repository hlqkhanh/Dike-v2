package com.dike.identity.application;

public final class AccountLinkRequiredException extends RuntimeException {

  public AccountLinkRequiredException() {
    super("Tài khoản cần được liên kết bằng một quy trình xác minh riêng");
  }
}
