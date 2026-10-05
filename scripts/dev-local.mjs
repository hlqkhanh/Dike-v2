import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";

const windows = process.platform === "win32";
const wrapper = windows ? ".\\mvnw.cmd" : "./mvnw";
const children = [];

const run = (command, args) => {
  const result = spawnSync(command, args, {
    shell: windows,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const assertPortFree = async (port) => {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", () =>
      reject(new Error(`Port ${port} is already in use.`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
};

const start = (label, command, args, environment = {}) => {
  const child = spawn(command, args, {
    env: { ...process.env, ...environment },
    shell: windows,
    stdio: ["inherit", "pipe", "pipe"],
  });
  const forward = (stream, destination) => {
    let pending = "";
    stream.on("data", (chunk) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) destination.write(`[${label}] ${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (code && !process.exitCode) process.exitCode = code;
  });
  children.push(child);
};

const stop = () => {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (windows) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
};

process.once("SIGINT", () => {
  stop();
  process.exit(130);
});
process.once("SIGTERM", () => {
  stop();
  process.exit(143);
});
process.once("exit", stop);

run("docker", ["version"]);
await Promise.all([3000, 8080].map(assertPortFree));
run("docker", [
  "compose",
  "-p",
  "dike",
  "-f",
  "infra/docker-compose.yml",
  "up",
  "-d",
  "--wait",
]);
run(wrapper, [
  "-B",
  "-ntp",
  "-pl",
  "apps/backend",
  "-am",
  "package",
  "-DskipTests",
]);

const jar = "apps/backend/target/dike-backend-0.0.1-SNAPSHOT.jar";
start("api", "java", ["-jar", jar], { SPRING_PROFILES_ACTIVE: "local,api" });
start("worker", "java", ["-jar", jar], {
  SPRING_PROFILES_ACTIVE: "local,worker",
});
start("web", windows ? "pnpm.cmd" : "pnpm", ["--filter", "@dike/web", "dev"]);

await Promise.all(children.map((child) => once(child, "exit")));
