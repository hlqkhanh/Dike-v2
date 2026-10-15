package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.planning.domain.RidePost;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.shared.api.ApiException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PostRouteServiceTest {
  final PostService posts = mock(PostService.class);
  final PostStore store = mock(PostStore.class);
  final PlanningStore routes = mock(PlanningStore.class);
  final PostRouteRecovery recovery = mock(PostRouteRecovery.class);
  final PostRouteService service = new PostRouteService(posts, store, routes, recovery);

  @Test
  void requestPrefillCanOnlyUseTheRequestersOwnedSnapshot() {
    var snapshot = mock(RouteSnapshot.class);
    when(snapshot.ownerUserId()).thenReturn("owner");
    when(routes.route("saved")).thenReturn(Optional.of(snapshot));
    assertThat(service.ownedSnapshot("owner", "saved")).isSameAs(snapshot);
    assertThatThrownBy(() -> service.ownedSnapshot("another-user", "saved"))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void accessIsCheckedBeforeReadingAnyRoute() {
    doThrow(new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Hidden"))
        .when(posts)
        .requireReadable("viewer", "post");
    assertThatThrownBy(() -> service.get("viewer", "post")).isInstanceOf(ApiException.class);
    verifyNoInteractions(store, routes, recovery);
  }

  @Test
  void returnsStoredGeometryToOtherAuthorizedViewersWithoutProviderRequests() {
    var post = mock(RidePost.class);
    when(post.routeId()).thenReturn("saved-route");
    when(post.ownerId()).thenReturn("owner");
    when(store.find("post")).thenReturn(Optional.of(post));
    var route = mock(RouteSnapshot.class);
    when(route.ownerUserId()).thenReturn("owner");
    var geometry = List.of(new RoutePoint(105.77, 20.98), new RoutePoint(105.78, 21.01));
    when(route.geometry()).thenReturn(geometry);
    when(route.distanceMeters()).thenReturn(4200L);
    when(route.durationSeconds()).thenReturn(600L);
    when(route.provider()).thenReturn("GOONG");
    when(routes.route("saved-route")).thenReturn(Optional.of(route));

    assertThat(service.get("viewer", "post"))
        .isEqualTo(new PostRouteService.View(geometry, 4200, 600, "GOONG"));
    verify(posts).requireReadable("viewer", "post");
    verifyNoInteractions(recovery);

    when(route.ownerUserId()).thenReturn("another-owner");
    assertThatThrownBy(() -> service.get("viewer", "post")).isInstanceOf(ApiException.class);
  }

  @Test
  void legacyDemoPostWithoutRouteDoesNotCallMongoWithNullId() {
    var post = mock(RidePost.class);
    var route = mock(RouteSnapshot.class);
    when(post.ownerId()).thenReturn("owner");
    when(route.ownerUserId()).thenReturn("owner");
    when(recovery.recover(post)).thenReturn(route);
    when(store.find("demo-post")).thenReturn(Optional.of(post));
    service.get("viewer", "demo-post");
    when(post.routeId()).thenReturn(" ");
    service.get("viewer", "demo-post");
    verify(recovery, times(2)).recover(post);
    verifyNoInteractions(routes);
  }

  @Test
  void missingSavedRouteTriggersRecovery() {
    var post = mock(RidePost.class);
    when(post.routeId()).thenReturn("missing");
    when(store.find("post")).thenReturn(Optional.of(post));
    when(routes.route("missing")).thenReturn(Optional.empty());
    when(recovery.recover(post))
        .thenThrow(
            new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ROUTING_UNAVAILABLE", "Try again"));
    assertThatThrownBy(() -> service.get("viewer", "post")).isInstanceOf(ApiException.class);
    verify(recovery).recover(post);
  }
}
