import { spawn } from "node:child_process";

const workload = process.argv[2];
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
