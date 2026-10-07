package com.dike.messaging;

import java.util.Map;

/** Public module port for durable, user-scoped notifications. */
public interface NotificationPublisher {

  void notify(String userId, String type, String title, String body, Map<String, String> data);
}
