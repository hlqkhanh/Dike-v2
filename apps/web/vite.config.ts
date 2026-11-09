import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { statSync } from "node:fs";

// This Vite config is only used by the Cloudflare trial scripts.
process.env.DIKE_API_INTERNAL_ORIGIN ??= "https://dike-api-demo.onrender.com";
process.env.DIKE_WEB_DEMO ??= "true";

export default defineConfig({
  define: {
    "process.env.DIKE_MODEL_BYTES": JSON.stringify(
      String(
        statSync(
          new URL("./public/images/HCMC-map-3dmodel2.glb", import.meta.url),
        ).size,
      ),
    ),
  },
  resolve: { dedupe: ["react", "react-dom"] },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
