"use client";

import { Client, type IMessage } from "@stomp/stompjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { ApiError } from "@dike/api-client-ts";
import { authApi } from "../auth/api";
import { handleAuthenticationError } from "../auth/session-expiry";
import { journeyApi } from "./api";

type RealtimeEnvelope = {
  type?: string;
  payload?: { conversationId?: string; bookingId?: string };
};

export function JourneyRealtimeMonitor() {
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  return session.data?.authenticated && session.data.user ? (
    <JourneyRealtimeConnection key={session.data.user.id} />
  ) : null;
}

function JourneyRealtimeConnection() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let ticketRetryTimer: number | undefined;
    const invalidateConversation = (message: IMessage) => {
      const event = parse(message);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (event.payload?.conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ["conversation", event.payload.conversationId],
        });
      }
    };
    const invalidateNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    const invalidateBooking = (message: IMessage) => {
      const event = parse(message);
      void queryClient.invalidateQueries({ queryKey: ["rides"] });
      if (event.payload?.bookingId) {
        const bookingId = event.payload.bookingId;
        for (const key of [
          "payment",
          "review-eligibility",
          "booking-reviews",
          "live-location",
        ]) {
          void queryClient.invalidateQueries({ queryKey: [key, bookingId] });
        }
      }
    };

    const client = new Client({
      reconnectDelay: 5_000,
      heartbeatIncoming: 20_000,
      heartbeatOutgoing: 20_000,
      debug: () => undefined,
      beforeConnect: async () => {
        try {
          const issued = await journeyApi.realtimeTicket();
          client.brokerURL = issued.websocketUrl;
          client.connectHeaders = { ticket: issued.ticket };
        } catch (err) {
          handleAuthenticationError(queryClient, err);
          // STOMP does not handle rejected beforeConnect promises. Stop this
          // attempt explicitly so a temporary ticket failure cannot become an
          // unhandled browser rejection, then retry while the session remains.
          await client.deactivate();
          if (!disposed && !(err instanceof ApiError && err.status === 401)) {
            ticketRetryTimer = window.setTimeout(
              () => client.activate(),
              5_000,
            );
          }
        }
      },
      onConnect: () => {
        client.subscribe("/user/queue/conversations", invalidateConversation);
        client.subscribe("/user/queue/notifications", invalidateNotification);
        client.subscribe("/user/queue/bookings", invalidateBooking);
      },
    });
    client.activate();
    return () => {
      disposed = true;
      if (ticketRetryTimer !== undefined) {
        window.clearTimeout(ticketRetryTimer);
      }
      void client.deactivate();
    };
  }, [queryClient]);

  return null;
}

function parse(message: IMessage): RealtimeEnvelope {
  try {
    return JSON.parse(message.body) as RealtimeEnvelope;
  } catch {
    return {};
  }
}
