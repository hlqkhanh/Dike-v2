package com.dike.ride.infrastructure;

import com.dike.ride.application.RideStore;
import com.dike.ride.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.mongodb.ReadPreference;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

@Repository
public class MongoRideStore implements RideStore {
  private final MongoTemplate mongo;
  private final AtomicCommands commands;

  public MongoRideStore(MongoTemplate mongo, AtomicCommands commands) {
    this.mongo = mongo;
    this.commands = commands;
  }

  private Query q(Criteria c) {
    return Query.query(c).withReadPreference(ReadPreference.primary());
  }

  public Optional<Trip> trip(String id) {
    return Optional.ofNullable(mongo.findOne(q(Criteria.where("_id").is(id)), Trip.class, "trips"));
  }

  public Optional<Proposal> proposal(String id) {
    return Optional.ofNullable(
        mongo.findOne(q(Criteria.where("_id").is(id)), Proposal.class, "ride_proposals"));
  }

  public Optional<Booking> booking(String id) {
    return Optional.ofNullable(
        mongo.findOne(q(Criteria.where("_id").is(id)), Booking.class, "bookings"));
  }

  public Optional<Booking> bookingForProposal(String id) {
    return Optional.ofNullable(
        mongo.findOne(q(Criteria.where("proposalId").is(id)), Booking.class, "bookings"));
  }

  public void insertTrip(Trip t) {
    mongo.insert(t, "trips");
  }

  public void saveTrip(Trip before, Trip after) {
    replace(before.id(), before.version(), after, "trips");
  }

  public void insertProposal(Proposal p) {
    mongo.insert(p, "ride_proposals");
  }

  public void saveProposal(Proposal before, Proposal after) {
    replace(before.id(), before.version(), after, "ride_proposals");
  }

  public void insertBooking(Booking b) {
    mongo.insert(b, "bookings");
  }

  public void saveBooking(Booking before, Booking after) {
    replace(before.id(), before.version(), after, "bookings");
  }

  private void replace(String id, long version, Object after, String collection) {
    if (mongo
            .replace(q(Criteria.where("_id").is(id).and("version").is(version)), after, collection)
            .getModifiedCount()
        != 1) throw new OptimisticLockingFailureException("Ride resource changed");
  }

  private Criteria page(Criteria scope, String after) {
    return after == null
        ? scope
        : new Criteria().andOperator(scope, Criteria.where("_id").gt(after));
  }

  public List<Trip> trips(String actor, String after, int limit) {
    return mongo.find(
        q(page(Criteria.where("driverId").is(actor), after)).with(Sort.by("_id")).limit(limit),
        Trip.class,
        "trips");
  }

  private Criteria participants(String actor) {
    return new Criteria()
        .orOperator(Criteria.where("passengerId").is(actor), Criteria.where("driverId").is(actor));
  }

  public List<Proposal> proposals(String actor, String after, int limit) {
    return mongo.find(
        q(page(participants(actor), after)).with(Sort.by("_id")).limit(limit),
        Proposal.class,
        "ride_proposals");
  }

  public List<Booking> bookings(String actor, String after, int limit) {
    return mongo.find(
        q(page(participants(actor), after)).with(Sort.by("_id")).limit(limit),
        Booking.class,
        "bookings");
  }

  public List<Proposal> pendingIntent(String id) {
    return mongo.find(
        q(Criteria.where("intentId").is(id).and("status").is("PENDING")),
        Proposal.class,
        "ride_proposals");
  }

  public List<Proposal> pendingTrip(String id) {
    return mongo.find(
        q(Criteria.where("tripId").is(id).and("status").is("PENDING")),
        Proposal.class,
        "ride_proposals");
  }

  public List<Booking> tripBookings(String id) {
    return mongo.find(q(Criteria.where("tripId").is(id)), Booking.class, "bookings");
  }

  public boolean activeIntent(String id) {
    return mongo.exists(
        q(
            Criteria.where("intentId")
                .is(id)
                .and("status")
                .in("CONFIRMED", "DRIVER_ARRIVED", "BOARDED", "IN_PROGRESS")),
        "bookings");
  }

  public void reserveInterval(String user, String id, Instant start, Instant end, String ownTrip) {
    commands.fence("availability", user);
    Criteria c =
        Criteria.where("userId")
            .is(user)
            .and("startAt")
            .lt(Date.from(end))
            .and("endAt")
            .gt(Date.from(start))
            .and("_id")
            .ne(id);
    if (ownTrip != null) c = c.and("tripId").ne(ownTrip);
    if (mongo.exists(q(c), "ride_intervals"))
      throw new ApiException(
          HttpStatus.CONFLICT, "AVAILABILITY_CONFLICT", "Lịch di chuyển bị trùng");
    mongo.upsert(
        q(Criteria.where("_id").is(id)),
        new Update()
            .set("userId", user)
            .set("startAt", Date.from(start))
            .set("endAt", Date.from(end))
            .set("tripId", ownTrip),
        "ride_intervals");
  }

  public void releaseInterval(String id) {
    mongo.remove(q(Criteria.where("_id").is(id)), "ride_intervals");
  }
}
