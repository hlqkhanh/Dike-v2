package com.dike.assistant.infrastructure;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.dike.shared.api.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.net.http.*;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GeminiAiGatewayTest {
  final HttpClient http = mock(HttpClient.class);
  final ObjectMapper json = new ObjectMapper();
  final SimpleMeterRegistry metrics = new SimpleMeterRegistry();
  final GeminiAiGateway gateway =
      new GeminiAiGateway(json, "test-key", "gemini-2.5-flash", true, http, metrics);

  @Test
  void disabledProviderMakesNoExternalRequest() {
    var disabled = new GeminiAiGateway(json, "", "gemini-2.5-flash", false, http, metrics);
    assertThatThrownBy(() -> disabled.extract("hello", "2026-11-10", "NONE", Map.of()))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(http);
  }

  @Test
  @SuppressWarnings("unchecked")
  void parsesStructuredOutputAndCountsUsage() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    String output =
        json.writeValueAsString(
            Map.of(
                "action",
                "INTENT",
                "helpTopic",
                "assistant",
                "fields",
                Map.of("date", "2026-11-11")));
    when(response.body())
        .thenReturn(
            json.writeValueAsString(
                Map.of(
                    "candidates",
                    java.util.List.of(
                        Map.of(
                            "finishReason",
                            "STOP",
                            "content",
                            Map.of("parts", java.util.List.of(Map.of("text", output))))),
                    "usageMetadata",
                    Map.of("totalTokenCount", 123))));
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
    var result = gateway.extract("mai", "2026-11-10", "NONE", Map.of());
    assertThat(result.fields()).containsEntry("date", "2026-11-11");
    assertThat(metrics.counter("dike.assistant.provider.tokens").count()).isEqualTo(123);
    assertThat(metrics.timer("dike.assistant.provider.duration").count()).isEqualTo(1);
    var capture = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
    verify(http).send(capture.capture(), any(HttpResponse.BodyHandler.class));
    assertThat(capture.getValue().headers().firstValue("x-goog-api-key")).contains("test-key");
    assertThat(capture.getValue().timeout()).contains(java.time.Duration.ofSeconds(15));
  }

  @Test
  @SuppressWarnings("unchecked")
  void quotaAndTruncatedOutputFailClosed() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
    when(response.statusCode()).thenReturn(429);
    assertThatThrownBy(() -> gateway.extract("test", "2026-11-10", "NONE", Map.of()))
        .isInstanceOf(ApiException.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn("{\"candidates\":[{\"finishReason\":\"MAX_TOKENS\"}]}");
    assertThatThrownBy(() -> gateway.extract("test", "2026-11-10", "NONE", Map.of()))
        .isInstanceOf(ApiException.class);
    assertThat(metrics.counter("dike.assistant.provider.errors").count()).isEqualTo(2);
  }

  @Test
  @SuppressWarnings("unchecked")
  void providerConfigurationAndAvailabilityErrorsAreActionableWithoutLeakingResponse()
      throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
    when(response.body()).thenReturn("private provider response containing test-key");
    for (var entry :
        Map.of(
                404,
                "Model AI",
                401,
                "API key",
                403,
                "API key",
                400,
                "Cấu hình yêu cầu",
                503,
                "quá tải")
            .entrySet()) {
      when(response.statusCode()).thenReturn(entry.getKey());
      assertThatThrownBy(() -> gateway.extract("mai", "2026-11-10", "NONE", Map.of()))
          .isInstanceOf(ApiException.class)
          .hasMessageContaining(entry.getValue())
          .hasMessageNotContaining("test-key")
          .hasMessageNotContaining("private provider response");
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void transientOverloadRetriesOnceAndRecoversWithoutChangingModel() throws Exception {
    HttpResponse<String> busy = mock(HttpResponse.class);
    HttpResponse<String> success = mock(HttpResponse.class);
    when(busy.statusCode()).thenReturn(503);
    when(success.statusCode()).thenReturn(200);
    when(success.body())
        .thenReturn(
            json.writeValueAsString(
                Map.of(
                    "candidates",
                    java.util.List.of(
                        Map.of(
                            "finishReason",
                            "STOP",
                            "content",
                            Map.of(
                                "parts",
                                java.util.List.of(
                                    Map.of(
                                        "text",
                                        "{\"action\":\"INTENT\",\"helpTopic\":\"assistant\",\"fields\":{\"departureTime\":\"07:00\"},\"answer\":\"\"}"))))))));
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(busy, success);
    assertThat(gateway.extract("Mai 7 giờ sáng", "2026-11-10", "NONE", Map.of()).fields())
        .containsEntry("departureTime", "07:00");
    var requests = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
    verify(http, times(2)).send(requests.capture(), any(HttpResponse.BodyHandler.class));
    assertThat(requests.getAllValues().get(1).uri())
        .isEqualTo(requests.getAllValues().getFirst().uri());
  }

  @Test
  @SuppressWarnings("unchecked")
  void persistentOverloadStopsAfterOneRetry() throws Exception {
    HttpResponse<String> busy = mock(HttpResponse.class);
    when(busy.statusCode()).thenReturn(503);
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(busy);
    assertThatThrownBy(() -> gateway.extract("mai", "2026-11-10", "NONE", Map.of()))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("quá tải");
    verify(http, times(2)).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
  }

  @Test
  @SuppressWarnings("unchecked")
  void timeoutGetsItsOwnReadableError() throws Exception {
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenThrow(new HttpTimeoutException("sensitive transport detail"));
    assertThatThrownBy(() -> gateway.extract("mai", "2026-11-10", "NONE", Map.of()))
        .isInstanceOf(ApiException.class)
        .hasMessageContaining("quá chậm")
        .hasMessageNotContaining("sensitive transport detail");
  }

  @Test
  @SuppressWarnings("unchecked")
  void unexpectedOrNonTextModelFieldsNeverReachDraftValidation() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
    for (String fields :
        java.util.List.of("{\"originPlaceRef\":\"invented-place\"}", "{\"seats\":1}")) {
      String output =
          "{\"action\":\"INTENT\",\"helpTopic\":\"assistant\",\"fields\":" + fields + "}";
      when(response.body())
          .thenReturn(
              json.writeValueAsString(
                  Map.of(
                      "candidates",
                      java.util.List.of(
                          Map.of(
                              "finishReason",
                              "STOP",
                              "content",
                              Map.of("parts", java.util.List.of(Map.of("text", output))))))));
      assertThatThrownBy(() -> gateway.extract("mai", "2026-11-10", "NONE", Map.of()))
          .isInstanceOf(ApiException.class)
          .hasMessageContaining("bản nháp chưa hợp lệ")
          .hasMessageNotContaining("invented-place");
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void preservesTheGroundedAnswerReturnedByTheProvider() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);
    String answer = "Dike kết nối người có xe và người cần đi ké.";
    String output =
        json.writeValueAsString(
            Map.of("action", "HELP", "helpTopic", "about", "fields", Map.of(), "answer", answer));
    when(response.body())
        .thenReturn(
            json.writeValueAsString(
                Map.of(
                    "candidates",
                    java.util.List.of(
                        Map.of(
                            "finishReason",
                            "STOP",
                            "content",
                            Map.of("parts", java.util.List.of(Map.of("text", output))))))));
    var result = gateway.extract("Dike là gì?", "2026-11-10", "NONE", Map.of());
    assertThat(result.action()).isEqualTo("HELP");
    assertThat(result.helpTopic()).isEqualTo("about");
    assertThat(result.answer()).isEqualTo(answer);
  }
}
