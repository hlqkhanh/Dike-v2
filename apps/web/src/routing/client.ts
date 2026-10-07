import { publicConfiguration } from "../config/public";
import { createRoutingApi } from "./api";

export const routingApi = createRoutingApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
