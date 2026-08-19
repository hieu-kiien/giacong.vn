import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const script = process.argv[2]?.trim() ?? "";
assert.match(script, /^scripts\/[a-z0-9-]+\.mjs$/i, "usage: run-staging-qa-with-direct-route-retry.mjs scripts/<qa-script>.mjs");

const directQa = process.env.STAGING_DIRECT_QA?.trim() === "1";
const maxAttempts = directQa ? 3 : 1;
const retryableTransportStatus = /\bHTTP (?:404|502|503|504)\b/;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const result = await run(script);
  if (result.code === 0) process.exit(0);

  const retryable = directQa && retryableTransportStatus.test(result.output);
  if (!retryable || attempt >= maxAttempts) {
    process.exit(result.code || 1);
  }

  console.log(`Temporary workers.dev QA transport returned a retryable HTTP status; retrying ${script} (${attempt + 1}/${maxAttempts}).`);
  await delay(3000);
}

function run(target) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [target], {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
