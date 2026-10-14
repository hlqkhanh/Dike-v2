import { ApiError } from "@dike/api-client-ts";
import type { QueryClient } from "@tanstack/react-query";

export function expireSession(client: QueryClient) {
  // Keep the anonymous session cached so active observers do not re-fetch in a loop.
  client.setQueryData(["auth", "session"], null);
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      !(
        query.queryKey.length === 2 &&
        query.queryKey[0] === "auth" &&
        query.queryKey[1] === "session"
      ),
  };
  void client.cancelQueries(filters).then(() => client.removeQueries(filters));
}

export function handleAuthenticationError(client: QueryClient, error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    expireSession(client);
    return true;
  }
  return false;
}
