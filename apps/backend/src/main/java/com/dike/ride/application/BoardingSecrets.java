package com.dike.ride.application;

public interface BoardingSecrets {
  void create(String bookingId);

  String reveal(String bookingId);

  boolean attempt(String bookingId, String code);

  void consume(String bookingId);
}
