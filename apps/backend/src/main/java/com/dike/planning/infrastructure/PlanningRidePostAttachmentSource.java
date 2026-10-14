package com.dike.planning.infrastructure;

import com.dike.messaging.RidePostAttachment;
import com.dike.messaging.RidePostAttachmentSource;
import com.dike.planning.application.PostService;
import org.springframework.stereotype.Component;

@Component
class PlanningRidePostAttachmentSource implements RidePostAttachmentSource {
  private final PostService posts;

  PlanningRidePostAttachmentSource(PostService posts) {
    this.posts = posts;
  }

  public Context load(String actor, String postId) {
    var post = posts.detail(actor, postId);
    return new Context(
        post.ownerId(),
        new RidePostAttachment(
            post.id(),
            post.type(),
            post.originLabel(),
            post.destinationLabel(),
            post.departureAt(),
            post.vehicleType(),
            post.remainingSeats(),
            post.contributionPerKm()));
  }
}
