package com.dike.planning.application;

import com.dike.planning.domain.RidePost;
import com.dike.planning.domain.RouteSnapshot;

public interface PostRouteRecovery {
  RouteSnapshot recover(RidePost post);
}
