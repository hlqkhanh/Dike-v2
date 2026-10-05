import { execFileSync } from "node:child_process";
import path from "node:path";

const candidates = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .map((file) => file.replaceAll("\\", "/"));

const forbiddenNames = new Set(["id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"]);
const forbiddenExtensions = new Set([
  ".key",
  ".pem",
  ".p12",
  ".pfx",
  ".jks",
  ".keystore",
  ".dump",
  ".sql",
  ".sqlite",
  ".sqlite3",
  ".bson",
]);
const forbiddenDirectories = new Set([
  "data",
  "uploads",
  "dump",
  "dumps",
  "volumes",
  "docker-data",
  ".docker-data",
]);

function isExampleEnvironmentFile(file) {
  return file === ".env.example" || /^\.env\.[^/]+\.example$/.test(file);
}

function isForbidden(file) {
  const parts = file.split("/");
  const basename = parts.at(-1).toLowerCase();
  const extension = path.posix.extname(basename);

  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    !isExampleEnvironmentFile(file)
  ) {
    return true;
  }

  return (
    forbiddenNames.has(basename) ||
    forbiddenExtensions.has(extension) ||
    parts.some((part) => forbiddenDirectories.has(part.toLowerCase()))
  );
}

const violations = candidates.filter(isForbidden);

if (violations.length > 0) {
  console.error("Forbidden sensitive or persistent-data files are tracked:");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log(
  `Repository file policy passed (${candidates.length} tracked or untracked files inspected).`,
);
