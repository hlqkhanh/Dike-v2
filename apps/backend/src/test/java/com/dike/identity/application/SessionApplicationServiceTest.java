package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.identity.infrastructure.security.IdentityProperties;
import com.dike.identity.infrastructure.security.SessionAttributes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;

class SessionApplicationServiceTest {

  @Test
  @SuppressWarnings("unchecked")
  void revokingAnotherDeviceReturnsFoundAndDeletesThatSession() {
    FindByIndexNameSessionRepository<Session> repository =
        mock(FindByIndexNameSessionRepository.class);
    Session target = mock(Session.class);
    when(target.getId()).thenReturn("target-session-id");
    when(target.getAttribute(SessionAttributes.HANDLE)).thenReturn("public-handle");
    when(repository.findByPrincipalName("user-1")).thenReturn(Map.of("target-session-id", target));
    HttpSession current = mock(HttpSession.class);
    when(current.getId()).thenReturn("current-session-id");
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getSession(false)).thenReturn(current);
    var service =
        new SessionApplicationService(
            repository, mock(IdentityProvisioningService.class), properties());

    boolean found = service.revoke(new DikePrincipal("user-1"), "public-handle", request);

    assertThat(found).isTrue();
    verify(repository).deleteById("target-session-id");
    verify(current, never()).invalidate();
  }

  private IdentityProperties properties() {
    return new IdentityProperties(
        URI.create("http://localhost:3000"),
        List.of(URI.create("http://localhost:3000")),
        false,
        new IdentityProperties.Session(
            Duration.ofHours(24), Duration.ofDays(30), Duration.ofMinutes(5), 10),
        new IdentityProperties.Cookie("DIKE_SESSION", false, "Lax"),
        new IdentityProperties.Google("https://accounts.google.com", "google"));
  }
}
