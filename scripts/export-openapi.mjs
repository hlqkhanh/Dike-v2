import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = fileURLToPath(new URL("..", import.meta.url));
const result = spawnSync(
  process.platform === "win32" ? ".\\mvnw.cmd" : "./mvnw",
  [
    "-B",
    "-ntp",
    "-Dtest=RuntimeContractTest",
    "-Dsurefire.failIfNoSpecifiedTests=false",
    "-Ddike.contract.write=true",
    "test",
  ],
  { cwd: root, shell: process.platform === "win32", stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const path = new URL("../docs/api/openapi.json", import.meta.url);
await writeFile(
  path,
  await format(await readFile(path, "utf8"), { parser: "json" }),
);
