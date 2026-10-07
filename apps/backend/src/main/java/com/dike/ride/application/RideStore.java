package com.dike.ride.application;

import com.dike.ride.domain.*;
import java.time.Instant;
import java.util.*;

public interface RideStore {
  Optional<Trip> trip(String id);

  Optional<Proposal> proposal(String id);

  Optional<Booking> booking(String id);

  Optional<Booking> bookingForProposal(String id);

  void insertTrip(Trip trip);

  void saveTrip(Trip before, Trip after);

  void insertProposal(Proposal proposal);

  void saveProposal(Proposal before, Proposal after);

  void insertBooking(Booking booking);

  void saveBooking(Booking before, Booking after);

  List<Trip> trips(String actor, String after, int limit);

  List<Proposal> proposals(String actor, String after, int limit);

  List<Booking> bookings(String actor, String after, int limit);

  List<Proposal> pendingIntent(String intent);

  List<Proposal> pendingTrip(String trip);

  List<Booking> tripBookings(String trip);

  boolean activeIntent(String intent);

  void reserveInterval(String user, String id, Instant start, Instant end, String ownTrip);

  void releaseInterval(String id);
}
