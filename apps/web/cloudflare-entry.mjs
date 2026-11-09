import app from "vinext/server/fetch-handler";
export * from "vinext/server/fetch-handler";

// Workers Static Assets caps each file at 25 MiB. Stream the original model
// from smaller assets so its URL and the existing viewer remain unchanged.
const worker = {
  ...app,
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname !== "/images/HCMC-map-3dmodel2.glb") {
      return app.fetch(request, env, context);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }
    const parts = await Promise.all(
      [0, 1, 2, 3].map((index) => {
        const part = new URL(`/model-parts/hcmc-${index}.bin`, url);
        return env.ASSETS.fetch(new Request(part, { method: request.method }));
      }),
    );
    if (parts.some((part) => !part.ok)) {
      await Promise.all(parts.map((part) => part.body?.cancel()));
      return new Response("Model unavailable", { status: 503 });
    }
    const headers = {
      "Content-Type": "model/gltf-binary",
      "Content-Length": process.env.DIKE_MODEL_BYTES,
      "Cache-Control": "public, max-age=3600",
    };
    if (request.method === "HEAD") return new Response(null, { headers });
    let index = 0;
    let reader = parts[0].body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        while (index < parts.length) {
          const next = await reader.read();
          if (!next.done) {
            controller.enqueue(next.value);
            return;
          }
          reader.releaseLock();
          index += 1;
          if (index < parts.length) reader = parts[index].body.getReader();
        }
        controller.close();
      },
      async cancel() {
        await reader.cancel();
        await Promise.all(
          parts.slice(index + 1).map((part) => part.body.cancel()),
        );
      },
    });
    return new Response(stream, { headers });
  },
};

export default worker;
