package com.dike.messaging;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableWebSocketMessageBroker
class RealtimeWebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

  private final RealtimeProperties properties;
  private final RealtimeTicketService tickets;

  RealtimeWebSocketConfiguration(RealtimeProperties properties, RealtimeTicketService tickets) {
    this.properties = properties;
    this.tickets = tickets;
  }

  @Override
  public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry
        .addEndpoint("/ws")
        .setAllowedOrigins(properties.allowedOrigins().toArray(String[]::new));
  }

  @Override
  public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.enableSimpleBroker("/queue", "/topic");
    registry.setUserDestinationPrefix("/user");
    registry.setApplicationDestinationPrefixes("/app");
  }

  @Override
  public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(new TicketChannelInterceptor(tickets));
  }

  private static final class TicketChannelInterceptor implements ChannelInterceptor {

    private final RealtimeTicketService tickets;

    private TicketChannelInterceptor(RealtimeTicketService tickets) {
      this.tickets = tickets;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
      StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
      StompCommand command = accessor.getCommand();
      if (command == StompCommand.CONNECT) {
        String ticket = first(accessor.getNativeHeader("ticket"));
        RealtimeTicketService.TicketPrincipal principal = tickets.consume(ticket);
        accessor.setUser(
            new UsernamePasswordAuthenticationToken(
                principal, null, AuthorityUtils.NO_AUTHORITIES));
      } else if (command == StompCommand.SEND) {
        throw new IllegalArgumentException("Client STOMP SEND is not supported");
      } else if (command == StompCommand.SUBSCRIBE) {
        if (accessor.getUser() == null
            || accessor.getDestination() == null
            || !accessor.getDestination().startsWith("/user/queue/")) {
          throw new IllegalArgumentException("Realtime subscription is not allowed");
        }
      }
      return message;
    }

    private String first(List<String> values) {
      return values == null || values.isEmpty() ? null : values.getFirst();
    }
  }
}
