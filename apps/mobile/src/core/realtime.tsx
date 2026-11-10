import { Client, type IMessage } from "@stomp/stompjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { createMobileApi, MobileApiError } from "./api";
import { useSession } from "./session";

type RealtimeTicket = {
  ticket: string;
  websocketUrl: string;
  expiresAt: string;
};

type RealtimeEnvelope = {
  eventId?: string;
  eventType?: string;
  payload?: {
    conversationId?: string;
    bookingId?: string;
    notificationId?: string;
  };
};

const invalidateMany = (
  client: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly unknown[])[],
) => {
  for (const queryKey of keys) {
    void client.invalidateQueries({ queryKey });
  }
};

export function MobileRealtimeMonitor() {
  const { session, token } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.authenticated ? session.user?.id : undefined;

  useEffect(() => {
    if (!token || !userId) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const api = createMobileApi(() => Promise.resolve(token));

    const invalidateConversation = (message: IMessage) => {
      const event = parse(message);
      const conversationId = event.payload?.conversationId;
      invalidateMany(queryClient, [
        ["mobile-conversations"],
        ["mobile-notifications"],
        ...(conversationId
          ? [
              ["mobile-conversation", conversationId] as const,
              ["mobile-messages", conversationId] as const,
            ]
          : []),
      ]);
    };

    const invalidateNotification = () => {
      // Notifications are also emitted for social and ride workflow changes.
      // Invalidating these summaries keeps badges, requests and feed cards in sync.
      invalidateMany(queryClient, [
        ["mobile-notifications"],
        ["mobile-feed"],
        ["mobile-my-posts"],
        ["mobile-active-responses"],
        ["mobile-response-inbox"],
        ["mobile-profile-posts"],
        ["mobile-bookings"],
      ]);
    };

    const invalidateBooking = (message: IMessage) => {
      const event = parse(message);
      const bookingId = event.payload?.bookingId;
      invalidateMany(queryClient, [
        ["mobile-bookings"],
        ["mobile-active-responses"],
        ["mobile-response-inbox"],
        ["mobile-feed"],
        ...(bookingId
          ? [
              ["mobile-booking", bookingId] as const,
              ["mobile-cash-payment", bookingId] as const,
              ["mobile-bank-payment", bookingId] as const,
              ["mobile-review-eligible", bookingId] as const,
            ]
          : []),
      ]);
    };

    const invalidateSocial = () => {
      invalidateMany(queryClient, [
        ["mobile-relation"],
        ["mobile-conversations"],
        ["mobile-notifications"],
        ["mobile-profile-posts"],
      ]);
    };

    const stomp = new Client({
      reconnectDelay: 5_000,
      heartbeatIncoming: 20_000,
      heartbeatOutgoing: 20_000,
      connectionTimeout: 10_000,
      debug: () => undefined,
      beforeConnect: async () => {
        try {
          const issued = await api.call<RealtimeTicket>(
            "/realtime/tickets",
            "POST",
          );
          stomp.brokerURL = issued.websocketUrl;
          stomp.connectHeaders = { ticket: issued.ticket };
        } catch (error) {
          await stomp.deactivate();
          if (
            !disposed &&
            !(error instanceof MobileApiError && error.status === 401)
          ) {
            retryTimer = setTimeout(() => stomp.activate(), 5_000);
          }
        }
      },
      onConnect: () => {
        stomp.subscribe("/user/queue/conversations", invalidateConversation);
        stomp.subscribe("/user/queue/notifications", invalidateNotification);
        stomp.subscribe("/user/queue/bookings", invalidateBooking);
        stomp.subscribe("/user/queue/social", invalidateSocial);
      },
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          invalidateMany(queryClient, [
            ["mobile-notifications"],
            ["mobile-conversations"],
            ["mobile-active-responses"],
          ]);
          if (!disposed && !stomp.active) stomp.activate();
        } else if (stomp.active) {
          void stomp.deactivate();
        }
      },
    );

    stomp.activate();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      appStateSubscription.remove();
      void stomp.deactivate();
    };
  }, [queryClient, token, userId]);

  return null;
}

function parse(message: IMessage): RealtimeEnvelope {
  try {
    return JSON.parse(message.body) as RealtimeEnvelope;
  } catch {
    return {};
  }
}
