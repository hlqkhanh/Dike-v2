package com.dike.trust.api;

import com.dike.trust.application.ReviewService;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ReviewController {
  private final ReviewService service;

  public ReviewController(ReviewService service) {
    this.service = service;
  }

  public record SubmitReview(String bookingId, int stars, String comment) {}

  @GetMapping("/bookings/{id}/review-eligibility")
  ReviewService.Eligibility eligibility(Principal principal, @PathVariable String id) {
    return service.eligibility(principal.getName(), id);
  }

  @PostMapping("/reviews")
  ReviewService.ReviewView submit(Principal principal, @RequestBody SubmitReview body) {
    return service.submit(principal.getName(), body.bookingId(), body.stars(), body.comment());
  }

  @GetMapping("/bookings/{id}/reviews")
  List<ReviewService.ReviewView> booking(Principal principal, @PathVariable String id) {
    return service.bookingReviews(principal.getName(), id);
  }

  @GetMapping("/users/{id}/ratings")
  List<ReviewService.RatingView> ratings(@PathVariable String id) {
    return service.ratings(id);
  }

  @GetMapping("/users/{id}/reviews")
  List<ReviewService.ReviewView> publicReviews(
      Principal principal,
      @PathVariable String id,
      @RequestParam(defaultValue = "DRIVER") String role,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.publicReviews(principal.getName(), id, role, cursor, limit);
  }

  @GetMapping("/me/reviews")
  List<ReviewService.ReviewView> mine(Principal principal) {
    return service.mine(principal.getName());
  }
}
