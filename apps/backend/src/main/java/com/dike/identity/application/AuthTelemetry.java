package com.dike.identity.application;

public interface AuthTelemetry {

  void login(String outcome);

  void session(String event);
}
