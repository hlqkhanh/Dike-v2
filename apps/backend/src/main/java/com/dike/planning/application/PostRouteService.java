package com.dike.planning.application;

import com.dike.planning.domain.RoutePoint;
import com.dike.shared.api.ApiException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Reads saved geometry and recovers missing routes only after checking post access. */
@Service
public class PostRouteService {
  private final PostService posts;
  private final PostStore postStore;
  private final PlanningStore routes;
  private final PostRouteRecovery recovery;

  public PostRouteService(
      PostService posts, PostStore postStore, PlanningStore routes, PostRouteRecovery recovery) {
    this.posts = posts;
    this.postStore = postStore;
    this.routes = routes;
    this.recovery = recovery;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RidePostRoute")
  public record View(
      List<RoutePoint> geometry, long distanceMeters, long durationSeconds, String provider) {}

  public View get(String viewer, String postId) {
    var route = snapshot(viewer, postId);
    return new View(
        route.geometry(), route.distanceMeters(), route.durationSeconds(), route.provider());
  }

  public com.dike.planning.domain.RouteSnapshot snapshot(String viewer, String postId) {
    posts.requireReadable(viewer, postId);
    var post = postStore.find(postId).orElseThrow(PostRouteService::missing);
    var saved =
        post.routeId() == null || post.routeId().isBlank()
            ? java.util.Optional.<com.dike.planning.domain.RouteSnapshot>empty()
            : routes.route(post.routeId());
    var route = saved.orElseGet(() -> recovery.recover(post));
    if (!post.ownerId().equals(route.ownerUserId())) throw missing();
    return route;
  }

  private static ApiException missing() {
    return new ApiException(HttpStatus.NOT_FOUND, "POST_ROUTE_NOT_FOUND", "Saved route not found");
  }
}
