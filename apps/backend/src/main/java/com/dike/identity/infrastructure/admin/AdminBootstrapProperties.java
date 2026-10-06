package com.dike.identity.infrastructure.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "dike.admin-bootstrap")
record AdminBootstrapProperties(
    boolean enabled, boolean dryRun, String accountId, String operator, String reason) {}
