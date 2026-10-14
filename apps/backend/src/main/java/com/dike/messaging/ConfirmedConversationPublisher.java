package com.dike.messaging;

/** Opens a direct conversation after both users have confirmed an external interaction. */
public interface ConfirmedConversationPublisher {
  String open(String firstUserId, String secondUserId);
}
