import { describe, expect, it } from "vitest";

import { createApiClientConfiguration } from "./index";

describe("API client configuration", () => {
  it("normalizes the base URL and defaults to cookie credentials", () => {
    expect(
      createApiClientConfiguration({
        baseUrl: "http://localhost:8080/api/v1/",
      }),
    ).toEqual({
      baseUrl: "http://localhost:8080/api/v1",
      credentials: "include",
      requestId: undefined,
    });
  });
});
