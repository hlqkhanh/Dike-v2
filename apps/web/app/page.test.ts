import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Stage 1 app shell", () => {
  it("keeps navigation, one primary heading and explicit platform states", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Điều hướng chính"');
    expect(source.match(/<h1/g)).toHaveLength(1);
    expect(source).toContain("Đang tải");
    expect(source).toContain("Ngoại tuyến");
    expect(source).toContain("Thử lại");
  });
});
