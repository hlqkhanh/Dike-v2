import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

if (!existsSync(".git")) {
  console.log("Git repository not found; skipping hook configuration.");
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    stdio: "inherit",
  });
  console.log("Configured Git hooks from .githooks.");
  if (process.versions.node === "24.21.0") {
    execFileSync(
      "git",
      ["config", "--local", "dike.nodePath", dirname(process.execPath)],
      { stdio: "inherit" },
    );
    console.log("Saved Node toolchain for Git clients in local Git configuration.");
  }
} catch (error) {
  console.error("Unable to configure Git hooks.");
  process.exitCode = 1;
}
