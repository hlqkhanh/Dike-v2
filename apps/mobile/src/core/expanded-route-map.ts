import type { RoutePoint } from "@dike/api-client-ts";
import type { RouteMapPresentation } from "./route-map-html";
export type ExpandedRouteMap = {
  geometry: RoutePoint[];
  presentation: RouteMapPresentation;
  passenger: boolean;
};
export const expandedMapKey = (postId: string, responseId = "") => [
  "expanded-route-map",
  postId,
  responseId,
];
