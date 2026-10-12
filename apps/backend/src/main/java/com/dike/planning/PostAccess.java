package com.dike.planning;

/** All mutating methods must join the caller's Mongo transaction. */
public interface PostAccess {
  record Terms(
      String id,
      String ownerId,
      String intentId,
      long version,
      long termsVersion,
      String visibility,
      String communityId,
      String routeId) {}

  Terms requireNeed(String viewer, String id);

  void requireReadable(String viewer, String id);

  void requireOpenOffer(String viewer, String tripId);

  void book(String postId, long expectedTerms);

  void reopenOffer(String tripId, boolean full);

  void publishOffer(String tripId);

  void invalidateTrip(String tripId);

  void refreshTrip(String tripId);

  String draftAgain(String actor, String postId);
}
