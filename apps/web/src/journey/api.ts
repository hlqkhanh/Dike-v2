import { createJourneyApi } from "@dike/api-client-ts";
import { publicConfiguration } from "../config/public";

export const journeyApi = createJourneyApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
