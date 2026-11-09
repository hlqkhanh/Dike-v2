import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Landing page", () => {
  it("keeps navigation, one primary heading and the main landing sections", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Điều hướng chính"');
    expect(source.match(/<h1/g)).toHaveLength(1);
    expect(source).toContain('id="dich-vu"');
    expect(source).toContain('id="ve-chung-toi"');
    expect(source).toContain('id="doi-tac"');
    expect(source).not.toContain('href="#trang-thai-he-thong"');
    expect(source).toContain("AuthNavigation");
  });
});
