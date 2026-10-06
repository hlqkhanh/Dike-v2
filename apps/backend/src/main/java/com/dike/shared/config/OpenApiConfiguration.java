package com.dike.shared.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfiguration {

  @Bean
  OpenAPI dikeOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("Dike API")
                .version("v1")
                .description("Contract for the Dike production API."))
        .servers(List.of(new Server().url("/")))
        .components(
            new Components()
                .addSchemas(
                    "FieldViolation",
                    new ObjectSchema()
                        .addProperty("field", new StringSchema())
                        .addProperty("code", new StringSchema()))
                .addSchemas(
                    "ErrorBody",
                    new ObjectSchema()
                        .addProperty("code", new StringSchema())
                        .addProperty("message", new StringSchema())
                        .addProperty("requestId", new StringSchema())
                        .addProperty(
                            "fields",
                            new ArraySchema()
                                .items(new Schema<>().$ref("#/components/schemas/FieldViolation"))))
                .addSchemas(
                    "ErrorResponse",
                    new ObjectSchema()
                        .addProperty(
                            "error", new Schema<>().$ref("#/components/schemas/ErrorBody")))
                .addSecuritySchemes(
                    "sessionCookie",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.COOKIE)
                        .name("DIKE_SESSION")));
  }
}
