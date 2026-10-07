package com.dike.messaging;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
class RedisRealtimePublisher implements RealtimePublisher {

  private final StringRedisTemplate redis;
  private final ObjectMapper json;
  private final RealtimeProperties properties;

  RedisRealtimePublisher(
      StringRedisTemplate redis, ObjectMapper json, RealtimeProperties properties) {
    this.redis = redis;
    this.json = json;
    this.properties = properties;
  }

  @Override
  public void publish(RealtimeEnvelope envelope) {
    try {
      redis.convertAndSend(properties.redisChannel(), json.writeValueAsString(envelope));
    } catch (JsonProcessingException exception) {
      throw new IllegalArgumentException("Realtime envelope cannot be serialized", exception);
    }
  }
}

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
class RedisRealtimeSubscriberConfiguration {

  private static final Logger LOGGER =
      LoggerFactory.getLogger(RedisRealtimeSubscriberConfiguration.class);

  @Bean
  RedisMessageListenerContainer realtimeListenerContainer(
      RedisConnectionFactory connectionFactory,
      RealtimeProperties properties,
      ObjectMapper json,
      SimpMessagingTemplate messaging) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    MessageListener listener =
        (Message message, byte[] pattern) -> {
          try {
            RealtimeEnvelope envelope =
                json.readValue(
                    new String(message.getBody(), StandardCharsets.UTF_8), RealtimeEnvelope.class);
            messaging.convertAndSendToUser(
                envelope.recipientUserId(), envelope.destination(), envelope);
          } catch (RuntimeException | JsonProcessingException exception) {
            LOGGER.warn("Rejected malformed realtime envelope", exception);
          }
        };
    container.addMessageListener(listener, new ChannelTopic(properties.redisChannel()));
    return container;
  }
}
