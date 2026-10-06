import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const workload = process.argv[2];
if (workload === "worker") {
  delete process.env.DIKE_GOOGLE_CLIENT_ID;
  delete process.env.DIKE_GOOGLE_CLIENT_SECRET;
}
if (!new Set(["api", "worker"]).has(workload)) {
  throw new Error("Usage: node scripts/run-backend.mjs <api|worker>");
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
  { shell: process.platform === "win32", stdio: "inherit" },
);

child.on("exit", (code) => process.exit(code ?? 1));
