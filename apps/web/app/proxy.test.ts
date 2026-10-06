import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("same-origin API proxy", () => {
  it("uses one server-side fixed upstream and reserves /api", () => {
    const source = readFileSync(
      new URL("../next.config.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain("DIKE_API_INTERNAL_ORIGIN");
    expect(source).not.toContain("NEXT_PUBLIC_DIKE_API_INTERNAL_ORIGIN");
    expect(source).toContain('source: "/api/:path*"');
    expect(source).toContain("apiOrigin.origin");
  });
});
