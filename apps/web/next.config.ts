import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@dike/api-client-ts",
    "@dike/design-tokens",
    "@dike/web-ui",
  ],
};

export default nextConfig;
