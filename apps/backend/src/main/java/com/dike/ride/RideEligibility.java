package com.dike.ride;

/** Implementations must join the caller transaction and fence against authority revocation. */
public interface RideEligibility {
  boolean active(String userId);

  boolean verified(String userId);

  boolean driver(String userId);

  void fence(String userId);
}
