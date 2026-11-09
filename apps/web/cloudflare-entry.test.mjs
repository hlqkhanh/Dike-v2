import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vinext/server/fetch-handler", () => ({
  default: { fetch: () => new Response("app route") },
}));

import worker from "./cloudflare-entry.mjs";

const modelUrl = "https://example.test/images/HCMC-map-3dmodel2.glb";
const env = {
  ASSETS: {
    fetch: async (request) => {
      const index = Number(new URL(request.url).pathname.match(/hcmc-(\d)/)[1]);
      return new Response(
        request.method === "HEAD" ? null : new Uint8Array([index, index + 1]),
        {
          headers: { "Content-Length": "2" },
        },
      );
    },
  },
};

describe("Cloudflare model streaming", () => {
  beforeEach(() => vi.stubEnv("DIKE_MODEL_BYTES", "8"));
  it("joins asset parts in order and preserves binary content", async () => {
    const response = await worker.fetch(new Request(modelUrl), env, {});
    expect(response.headers.get("Content-Type")).toBe("model/gltf-binary");
    expect(response.headers.get("Content-Length")).toBe("8");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4,
    ]);
  });

  it("returns model headers without a body for HEAD", async () => {
    const response = await worker.fetch(
      new Request(modelUrl, { method: "HEAD" }),
      env,
      {},
    );
    expect(response.headers.get("Content-Length")).toBe("8");
    expect(response.body).toBeNull();
  });

  it("reports unavailable assets without serving a corrupt model", async () => {
    const response = await worker.fetch(
      new Request(modelUrl),
      {
        ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
      },
      {},
    );
    expect(response.status).toBe(503);
  });

  it("rejects writes to the static model", async () => {
    const response = await worker.fetch(
      new Request(modelUrl, { method: "POST" }),
      env,
      {},
    );
    expect(response.status).toBe(405);
  });

  it("delegates application routes to vinext", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/login"),
      env,
      {},
    );
    expect(await response.text()).toBe("app route");
  });
});
