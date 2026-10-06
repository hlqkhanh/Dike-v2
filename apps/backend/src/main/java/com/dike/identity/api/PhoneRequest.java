package com.dike.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhoneRequest(@NotBlank @Size(max = 32) String phoneNumber) {}
