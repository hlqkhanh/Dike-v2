import { createProfileApi } from "@dike/api-client-ts";

import { publicConfiguration } from "../config/public";

export const profileApi = createProfileApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
