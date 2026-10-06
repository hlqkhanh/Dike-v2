package com.dike.identity.api;

import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.OtpTestCodeReader;
import com.dike.identity.infrastructure.security.SessionAttributes;
import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth/test/otp")
@ConditionalOnProperty(prefix = "dike.otp", name = "provider", havingValue = "fake")
final class FakeOtpDebugController {

  private final OtpTestCodeReader codes;

  FakeOtpDebugController(OtpTestCodeReader codes) {
    this.codes = codes;
  }

  @GetMapping("/{challengeId}")
  TestCode read(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String challengeId,
      HttpServletRequest request) {
    if (!isLoopback(request.getRemoteAddr())) throw notFound();
    String deviceSessionId = (String) request.getSession().getAttribute(SessionAttributes.HANDLE);
    String code =
        codes.read(principal.userId(), deviceSessionId, challengeId).orElseThrow(this::notFound);
    return new TestCode(code);
  }

  private boolean isLoopback(String address) {
    try {
      return InetAddress.getByName(address).isLoopbackAddress();
    } catch (UnknownHostException invalid) {
      return false;
    }
  }

  private ResponseStatusException notFound() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND);
  }

  record TestCode(String code) {}
}
