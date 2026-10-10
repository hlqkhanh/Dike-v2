package com.dike;

import java.security.Principal;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/demo")
@ConditionalOnExpression("'${dike.environment:local}' == 'local' && ${dike.demo.seed-enabled:true}")
public class DemoDataController {

  private final DemoDataService demo;

  public DemoDataController(DemoDataService demo) {
    this.demo = demo;
  }

  @PostMapping("/seed")
  DemoDataService.DemoSummary seed(Principal principal) {
    return demo.seedFor(principal.getName());
  }
}
