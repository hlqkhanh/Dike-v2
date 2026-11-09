import { spawn, spawnSync } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { loadLocalGoogleOAuth } from "./load-local-google-oauth.mjs";

if (existsSync(".env.local")) loadEnvFile(".env.local");
loadLocalGoogleOAuth();

const windows = process.platform === "win32";
const wrapper = windows ? ".\\mvnw.cmd" : "./mvnw";
const children = [];

const run = (label, command, args, timeout = 10 * 60_000) => {
  process.stdout.write(`[setup] ${label}...\n`);
  const result = spawnSync(command, args, {
    shell: windows,
    stdio: "inherit",
    timeout,
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(
      `${label} không phản hồi sau ${Math.round(timeout / 1000)} giây.`,
    );
  }
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  process.stdout.write(`[setup] ${label} hoàn tất.\n`);
};

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

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

const infrastructurePorts = [
  Number(process.env.DIKE_MONGODB_PORT ?? 27017),
  6379,
  9000,
];
const infrastructureReady = (
  await Promise.all(infrastructurePorts.map(isPortOpen))
).every(Boolean);
if (infrastructureReady) {
  process.stdout.write(
    "[setup] MongoDB, Redis và MinIO đã chạy; tái sử dụng hạ tầng hiện có.\n",
  );
} else {
  run("Kiểm tra Docker", "docker", ["version"], 15_000);
}
process.stdout.write("[setup] Kiểm tra cổng 3000 và 8080...\n");
await Promise.all([3000, 8080].map(assertPortFree));
process.stdout.write("[setup] Các cổng ứng dụng đang trống.\n");
if (!infrastructureReady) {
  run(
    "Khởi động MongoDB, Redis và MinIO",
    "docker",
    [
      "compose",
      "-p",
      "dike",
      "-f",
      "infra/docker-compose.yml",
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "120",
    ],
    150_000,
  );
}
run("Build backend", wrapper, [
  "-B",
  "-ntp",
  "-pl",
  "apps/backend",
  "-am",
  "package",
  "-DskipTests",
]);

const jar = "apps/backend/target/dike-backend-0.0.1-SNAPSHOT.jar";
process.stdout.write("[setup] Khởi động backend và web...\n");
start("backend", "java", ["-jar", jar], {
  SPRING_PROFILES_ACTIVE: "local,combined",
  DIKE_ROUTING_ALLOW_UNVERIFIED_MEMBERS: "true",
});
start("web", windows ? "pnpm.cmd" : "pnpm", ["--filter", "@dike/web", "dev"]);

await Promise.all(children.map((child) => once(child, "exit")));
