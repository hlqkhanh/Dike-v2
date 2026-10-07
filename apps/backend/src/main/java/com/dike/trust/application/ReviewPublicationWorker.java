package com.dike.trust.application;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class ReviewPublicationWorker {
  private final ReviewService reviews;

  ReviewPublicationWorker(ReviewService reviews) {
    this.reviews = reviews;
  }

  @Scheduled(fixedDelayString = "${dike.trust.review-publication-interval:1m}")
  void publish() {
    reviews.publishDue();
  }
}
