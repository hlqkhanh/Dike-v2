package com.dike.messaging;

import java.time.Instant;

record RealtimeTicket(String ticket, String websocketUrl, Instant expiresAt) {}
