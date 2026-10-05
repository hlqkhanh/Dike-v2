import { describe, expect, it } from "vitest";

import { colors, spacing } from "./index";

describe("Urban Mint design tokens", () => {
  it("exports stable semantic tokens", () => {
    expect(colors.primary).toBe("#087f5b");
    expect(spacing.md).toBe("1rem");
  });
});
