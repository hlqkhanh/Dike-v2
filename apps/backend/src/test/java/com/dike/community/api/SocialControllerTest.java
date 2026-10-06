package com.dike.community.api;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.dike.community.application.SocialService;
import com.dike.community.domain.SocialRelation.Action;
import com.dike.shared.api.GlobalExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class SocialControllerTest {
  @Test
  void missingKeyAndMalformedPaginationReturnClientErrors() throws Exception {
    var service = mock(SocialService.class);
    var mvc =
        MockMvcBuilders.standaloneSetup(new SocialController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    mvc.perform(put("/api/v1/blocks/other").principal(() -> "a"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
    mvc.perform(get("/api/v1/friendships?limit=garbage").principal(() -> "a"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(service);
  }

  @Test
  void actorComesFromPrincipalAndActionFromRoute() throws Exception {
    var service = mock(SocialService.class);
    var mvc =
        MockMvcBuilders.standaloneSetup(new SocialController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    when(service.command("a", Action.SEND, "b", null, "request-key-1"))
        .thenReturn(
            new SocialService.RelationView(
                "b", "B", "OUTGOING", "invitation", null, false, 1, List.of("CANCEL", "BLOCK")));
    mvc.perform(
            post("/api/v1/friendships/requests")
                .principal(() -> "a")
                .header("Idempotency-Key", "request-key-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUserId\":\"b\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.requestId").value("invitation"));
    verify(service).command("a", Action.SEND, "b", null, "request-key-1");
    mvc.perform(
            post("/api/v1/friendships/requests")
                .principal(() -> "a")
                .header("Idempotency-Key", "request-key-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetUserId\":\"$bad\"}"))
        .andExpect(status().isBadRequest());
  }
}
