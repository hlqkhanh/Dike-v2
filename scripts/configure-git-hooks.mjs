import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".git")) {
  console.log("Git repository not found; skipping hook configuration.");
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "inherit"
  });
  console.log("Configured Git hooks from .githooks.");
} catch (error) {
  console.error("Unable to configure Git hooks.");
  process.exitCode = 1;
}

