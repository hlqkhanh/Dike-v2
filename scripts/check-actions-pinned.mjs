import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const workflowDirectory = ".github/workflows";
const workflowFiles = existsSync(workflowDirectory)
  ? readdirSync(workflowDirectory)
      .filter((file) => /\.ya?ml$/i.test(file))
      .map((file) => path.join(workflowDirectory, file))
  : [];
const violations = [];

for (const file of workflowFiles) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if (!match) return;

    const reference = match[1];
    if (reference.startsWith("./") || reference.startsWith("docker://")) return;

    const version = reference.split("@").at(-1);
    if (!/^[0-9a-f]{40}$/i.test(version)) {
      violations.push(`${file}:${index + 1}: ${reference}`);
    }
  });
}

if (violations.length > 0) {
  console.error("GitHub Actions must be pinned to a full 40-character commit SHA:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`Action pin policy passed (${workflowFiles.length} workflow files inspected).`);

