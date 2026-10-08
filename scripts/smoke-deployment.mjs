#!/usr/bin/env node

const [, , rawBaseUrl] = process.argv;

if (!rawBaseUrl) {
  console.error(
    "Usage: node scripts/smoke-deployment.mjs https://api.example.com",
  );
  process.exit(2);
}

const baseUrl = new URL(rawBaseUrl);
const localHosts = new Set(["localhost", "127.0.0.1"]);
if (baseUrl.protocol !== "https:" && !localHosts.has(baseUrl.hostname)) {
  throw new Error("Smoke tests require HTTPS outside localhost");
}

const probes = [
  ["liveness", "/actuator/health/liveness", "UP"],
  ["readiness", "/actuator/health/readiness", "UP"],
  ["OpenAPI", "/api/openapi.json", undefined],
];

for (const [name, path, expectedStatus] of probes) {
  const url = new URL(path, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "dike-release-smoke/1",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${name} returned HTTP ${response.status}`);
    }
    const body = await response.json();
    if (expectedStatus && body.status !== expectedStatus) {
      throw new Error(`${name} returned status ${String(body.status)}`);
    }
    if (name === "OpenAPI" && (!body.openapi || !body.paths)) {
      throw new Error("OpenAPI response is missing contract fields");
    }
    console.log(`${name}: OK`);
  } finally {
    clearTimeout(timeout);
  }
}
