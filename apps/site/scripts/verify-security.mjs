import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const cli = require.resolve("next/dist/bin/next");

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function responseAt(url) {
  const response = await fetch(url);
  const html = await response.text();
  const csp = response.headers.get("content-security-policy") || "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  const scripts = html.match(/<script\b[^>]*>/g) || [];

  assert(nonce, "CSP nonce missing");
  assert(scripts.length > 0, "Next.js scripts missing");
  assert(scripts.every((tag) => tag.includes(`nonce="${nonce}"`)), "script nonce mismatch");
  assert(csp.includes("frame-ancestors 'none'"));
  assert(csp.includes("object-src 'none'"));
  assert(csp.includes("style-src-attr 'none'"));
  assert(!csp.includes("unsafe-inline"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  assert((response.headers.get("cache-control") || "").includes("no-store"));
  assert.equal(response.headers.get("set-cookie"), null);
  assert(!html.includes("fonts.googleapis.com") && !html.includes("fonts.gstatic.com"));
  return { response, html, nonce };
}

const port = await unusedPort();
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [cli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "ignore",
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error("Site server exited before readiness");
    try {
      const response = await fetch(origin);
      ready = response.ok;
      if (ready) break;
    } catch {}
    await delay(200);
  }
  assert(ready, "Site server did not start");

  const first = await responseAt(origin);
  const second = await responseAt(origin);
  assert.equal(first.response.status, 200);
  assert.notEqual(first.nonce, second.nonce, "CSP nonce must change on every request");

  const missing = await responseAt(`${origin}/does-not-exist`);
  assert.equal(missing.response.status, 404);

  const stylesheet = first.html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
  assert(stylesheet?.startsWith("/_next/static/"), "self-hosted stylesheet missing");
  const css = await fetch(`${origin}${stylesheet}`);
  assert.equal(css.status, 200);
  assert.equal(css.headers.get("x-content-type-options"), "nosniff");
  assert(!(await css.text()).includes("fonts.googleapis.com"));

  console.log("Security smoke check passed: headers, rotating CSP nonces, 404, local assets.");
} finally {
  child.kill("SIGTERM");
}
