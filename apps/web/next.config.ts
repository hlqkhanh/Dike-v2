import type { NextConfig } from "next";

const apiOrigin = new URL(
  process.env.DIKE_API_INTERNAL_ORIGIN ?? "http://localhost:8080",
);

if (apiOrigin.pathname !== "/" || apiOrigin.search || apiOrigin.hash) {
  throw new Error("DIKE_API_INTERNAL_ORIGIN must be an origin without a path");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@dike/api-client-ts",
    "@dike/design-tokens",
    "@dike/web-ui",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin.origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
