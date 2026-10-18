#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { createServer } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

if (process.cwd() !== root) {
  process.chdir(root);
}

async function reserveFreePort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() =>
          reject(new Error("Could not resolve free browser-test port.")),
        );
        return;
      }

      const port = address.port;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

const browserPort = await reserveFreePort();

const server = await createServer({
  root,
  server: {
    host: "127.0.0.1",
    port: browserPort,
    strictPort: true,
  },
});

let closing = false;

async function closeServer() {
  if (closing) return;
  closing = true;
  await server.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await closeServer();
    process.kill(process.pid, signal);
  });
}

try {
  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve isolated Vite server address.");
  }

  const baseURL = `http://127.0.0.1:${address.port}`;
  console.log(`WAKILISHA_UI_BROWSER_BASE_URL=${baseURL}`);

  const binary = path.join(
    root,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "playwright.cmd" : "playwright",
  );

  const child = spawn(
    binary,
    [
      "test",
      "--config",
      "playwright.config.ts",
      ...process.argv.slice(2),
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        WAKILISHA_UI_BROWSER_BASE_URL: baseURL,
      },
    },
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(
          new Error(`Playwright terminated by signal ${signal}.`),
        );
        return;
      }
      resolve(code ?? 1);
    });
  });

  process.exitCode = exitCode;
} finally {
  await closeServer();
}
