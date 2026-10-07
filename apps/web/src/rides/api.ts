import { createRideApi } from "@dike/api-client-ts";
import { publicConfiguration } from "../config/public";
export const rideApi = createRideApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
