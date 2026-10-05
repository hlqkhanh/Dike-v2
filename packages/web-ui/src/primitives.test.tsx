import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, Card, Input, LayoutShell, Status } from "./index";

describe("web UI primitives", () => {
  it("renders accessible native semantics", () => {
    const markup = renderToStaticMarkup(
      <LayoutShell header={<span>Dike</span>}>
        <Card>
          <Input label="Điểm đi" name="origin" error="Bắt buộc" />
          <Status tone="success">Sẵn sàng</Status>
          <Button type="button">Tiếp tục</Button>
        </Card>
      </LayoutShell>,
    );

    expect(markup).toContain("<header>");
    expect(markup).toContain("<main>");
    expect(markup).toContain('for="origin"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('type="button"');
  });
});
