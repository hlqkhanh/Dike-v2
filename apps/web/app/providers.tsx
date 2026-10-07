"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SocialSessionMonitor } from "../src/social/invalidation";
import { JourneyRealtimeMonitor } from "../src/journey/realtime";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 30_000 },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SocialSessionMonitor />
      <JourneyRealtimeMonitor />
      {children}
    </QueryClientProvider>
  );
}
