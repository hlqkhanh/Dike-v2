import { spawnSync } from "node:child_process";

const wrapper = process.platform === "win32" ? ".\\mvnw.cmd" : "./mvnw";
const result = spawnSync(wrapper, ["-B", "-ntp", "verify"], {
  shell: process.platform === "win32",
  stdio: "inherit",
});
process.exit(result.status ?? 1);
