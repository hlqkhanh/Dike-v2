package com.dike.identity.application;

public record GoogleIdentityClaims(
    String issuer,
    String subject,
    String email,
    boolean emailVerified,
    String displayName,
    String avatarUrl) {}
