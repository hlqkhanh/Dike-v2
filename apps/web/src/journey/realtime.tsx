"use client";

import { Client, type IMessage } from "@stomp/stompjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { authApi } from "../auth/api";
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
  return session.data ? (
    <JourneyRealtimeConnection key={session.data.user.id} />
  ) : null;
}

function JourneyRealtimeConnection() {
  const queryClient = useQueryClient();

  useEffect(() => {
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
        const issued = await journeyApi.realtimeTicket();
        client.brokerURL = issued.websocketUrl;
        client.connectHeaders = { ticket: issued.ticket };
      },
      onConnect: () => {
        client.subscribe("/user/queue/conversations", invalidateConversation);
        client.subscribe("/user/queue/notifications", invalidateNotification);
        client.subscribe("/user/queue/bookings", invalidateBooking);
      },
    });
    client.activate();
    return () => {
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
