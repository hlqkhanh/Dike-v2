import { createAuthApi } from "@dike/api-client-ts";

import { publicConfiguration } from "../config/public";

export const authApi = createAuthApi({
  baseUrl: publicConfiguration().apiBaseUrl,
  credentials: "include",
  requestId: () => crypto.randomUUID(),
});
