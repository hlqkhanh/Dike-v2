package com.dike.planning.infrastructure.routing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike.planning.contribution")
public record ContributionProperties(
    boolean demo,
    @NotNull @DecimalMin("0") BigDecimal fuelPriceVndPerLiter,
    @NotNull @DecimalMin("0") BigDecimal motorbikeLitersPer100Km,
    @NotNull @DecimalMin("0") BigDecimal carLitersPer100Km,
    @NotNull @DecimalMin("0") BigDecimal minimumPerKmVnd,
    @NotNull @DecimalMin("0") BigDecimal maximumPerKmVnd) {

  public ContributionProperties {
    if (minimumPerKmVnd != null
        && maximumPerKmVnd != null
        && maximumPerKmVnd.compareTo(minimumPerKmVnd) < 0) {
      throw new IllegalArgumentException("Maximum contribution must not be below minimum");
    }
  }
}
