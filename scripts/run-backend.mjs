import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { loadLocalGoogleOAuth } from "./load-local-google-oauth.mjs";

if (existsSync(".env.local")) loadEnvFile(".env.local");
loadLocalGoogleOAuth();

const workload = process.argv[2];
if (!new Set(["api", "worker", "combined"]).has(workload)) {
  throw new Error("Usage: node scripts/run-backend.mjs <api|worker|combined>");
}

const wrapper = process.platform === "win32" ? ".\\mvnw.cmd" : "./mvnw";
const child = spawn(
  wrapper,
  [
    "-f",
    "apps/backend/pom.xml",
    "spring-boot:run",
    `-Dspring-boot.run.profiles=local,${workload}`,
  ],
  {
    env: {
      ...process.env,
      DIKE_ROUTING_ALLOW_UNVERIFIED_MEMBERS:
        process.env.DIKE_ROUTING_ALLOW_UNVERIFIED_MEMBERS ?? "true",
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

child.on("exit", (code) => process.exit(code ?? 1));
