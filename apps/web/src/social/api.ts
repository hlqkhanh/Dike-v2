import { createSocialApi } from "@dike/api-client-ts";
import { publicConfiguration } from "../config/public";

export const socialApi = createSocialApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
