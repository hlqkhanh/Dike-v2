package com.dike.shared.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class WorkloadProfileTest {

  @Test
  void apiWorkerAndCombinedProfilesKeepTheirWebBoundary() throws IOException {
    assertThat(resource("application-api.yml"))
        .contains("workload: api", "web-application-type: servlet");
    assertThat(resource("application-worker.yml"))
        .contains("workload: worker", "web-application-type: none");
    assertThat(resource("application-combined.yml"))
        .contains("workload: combined", "web-application-type: servlet");
  }

  private String resource(String name) throws IOException {
    return new ClassPathResource(name).getContentAsString(StandardCharsets.UTF_8);
  }
}
