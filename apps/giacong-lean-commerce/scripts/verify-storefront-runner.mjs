import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { nextBinPath } from "./next-bin.mjs";

const root = new URL("../", import.meta.url);

function waitForReady(child, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Next did not become ready.\n${output}`));
    }, timeoutMs);
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes("Ready in") || output.includes("ready started server")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`Next exited before readiness (${code}).\n${output}`));
      }
    });
  });
}

export async function runStorefrontSmoke(name, paths) {
  const existingBaseUrl = await findExistingBaseUrl();
  if (existingBaseUrl) {
    await verifyPaths(name, paths, existingBaseUrl);
    return;
  }

  const port = Number(process.env.QA_PREVIEW_PORT || process.env.COMMERCE_PREVIEW_PORT || 4310);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`Invalid QA_PREVIEW_PORT: ${port}`);
  }

  const child = spawn(process.execPath, [nextBinPath, "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: new URL(root).pathname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForReady(child);
    await verifyPaths(name, paths, `http://127.0.0.1:${port}`);
  } finally {
    child.kill("SIGTERM");
  }
}

async function verifyPaths(name, paths, baseUrl) {
  for (const path of paths) {
    const response = await fetch(new URL(path, `${baseUrl}/`), {
      headers: { "x-giacong-qa": name },
    });
    if (!response.ok) {
      throw new Error(`${name}: ${path} returned HTTP ${response.status}`);
    }
  }
  console.log(`${name}: ${paths.length} route(s) returned successfully`);
}

async function findExistingBaseUrl() {
  if (process.env.QA_BASE_URL) return process.env.QA_BASE_URL.replace(/\/$/, "");

  let lock;
  try {
    lock = JSON.parse(await readFile(new URL(".next/dev/lock", root), "utf8"));
  } catch {
    return null;
  }
  if (!lock || typeof lock !== "object" || !Number.isInteger(lock.pid) || !Number.isInteger(lock.port)) return null;

  try {
    const baseUrl = `http://127.0.0.1:${lock.port}`;
    const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(1_000) });
    return response.ok ? baseUrl : null;
  } catch {
    return null;
  }
}