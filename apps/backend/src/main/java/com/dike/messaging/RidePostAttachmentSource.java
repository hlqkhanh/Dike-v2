package com.dike.messaging;

/** Resolves a readable post and its owner before a journey can be shared. */
public interface RidePostAttachmentSource {
  Context load(String actor, String postId);

  record Context(String ownerId, RidePostAttachment attachment) {}
}
