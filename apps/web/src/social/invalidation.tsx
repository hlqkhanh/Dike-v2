"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { socialApi } from "./api";
import { authApi } from "../auth/api";

export function SocialSessionMonitor() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  return session.data ? (
    <SocialInvalidation
      key={session.data.user.id}
      userId={session.data.user.id}
    />
  ) : null;
}

const protectedKeys = new Set(["profile", "social", "schedule", "feed"]);
export async function clearSocialContent(client: QueryClient) {
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      protectedKeys.has(String(query.queryKey[0])),
  };
  await client.cancelQueries(filters);
  // Reset removes previously authorized data while active observers re-fetch.
  await client.resetQueries(filters);
}
export function broadcastSocialChange() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("dike-social");
  channel.postMessage("changed");
  channel.close();
}

export function SocialInvalidation({ userId }: { userId: string }) {
  const client = useQueryClient();
  const seen = useRef<number | undefined>(undefined);
  const revision = useQuery({
    queryKey: ["social-revision", userId],
    queryFn: socialApi.revision,
    refetchInterval: 5_000,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });
  useEffect(() => {
    if (revision.isError) {
      void clearSocialContent(client);
      return;
    }
    if (revision.data) {
      if (seen.current !== revision.data.revision)
        void clearSocialContent(client);
      seen.current = revision.data.revision;
    }
  }, [revision.data, revision.isError, client]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("dike-social");
    channel.onmessage = () => {
      void clearSocialContent(client);
    };
    return () => channel.close();
  }, [client]);
  return null;
}
