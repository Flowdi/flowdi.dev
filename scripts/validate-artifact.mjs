import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
const manifestPath = resolve(projectRoot, "dist/.openai/hosting.json");

const [source, manifestSource] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(manifestPath, "utf8"),
]);

const manifest = JSON.parse(manifestSource);
assert.equal(manifest.static, undefined, "Worker manifest must not contain static configuration");

const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
const worker = workerModule.default;
assert.equal(typeof worker?.fetch, "function", "Worker must export default.fetch");

const response = await worker.fetch(new Request("https://flowdi.dev/"));
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
assert.equal(response.headers.get("x-frame-options"), "DENY");
assert.equal(response.headers.get("x-content-type-options"), "nosniff");
assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
assert.equal(response.headers.get("referrer-policy"), "no-referrer");
assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);

const csp = response.headers.get("content-security-policy") ?? "";
assert.match(csp, /frame-ancestors 'none'/);
assert.match(csp, /default-src 'none'/);
assert.match(csp, /script-src 'sha256-[^']+'/);
assert.match(csp, /style-src 'sha256-[^']+'/);
assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);

const html = await response.text();
assert.match(html, /<title>flowdi\.dev — Tools for WoW Guilds<\/title>/);

const headResponse = await worker.fetch(new Request("https://flowdi.dev/", { method: "HEAD" }));
assert.equal(headResponse.status, 200);
assert.equal(await headResponse.text(), "");

const methodResponse = await worker.fetch(new Request("https://flowdi.dev/", { method: "POST" }));
assert.equal(methodResponse.status, 405);
assert.equal(methodResponse.headers.get("allow"), "GET, HEAD");

const robotsResponse = await worker.fetch(new Request("https://flowdi.dev/robots.txt"));
assert.equal(robotsResponse.status, 200);
assert.match(robotsResponse.headers.get("content-type") ?? "", /^text\/plain/);
assert.match(await robotsResponse.text(), /Sitemap: https:\/\/flowdi\.dev\/sitemap\.xml/);

const sitemapResponse = await worker.fetch(new Request("https://flowdi.dev/sitemap.xml"));
assert.equal(sitemapResponse.status, 200);
assert.match(sitemapResponse.headers.get("content-type") ?? "", /^application\/xml/);
assert.match(await sitemapResponse.text(), /<loc>https:\/\/flowdi\.dev\/<\/loc>/);
assert.equal(sitemapResponse.headers.get("x-content-type-options"), "nosniff");

const missingResponse = await worker.fetch(new Request("https://flowdi.dev/missing"));
assert.equal(missingResponse.status, 404);
assert.equal(missingResponse.headers.get("x-frame-options"), "DENY");

const fallbackResponse = await worker.fetch(new Request("https://flowdi.flowditv.chatgpt.site/"));
assert.equal(fallbackResponse.status, 308);
assert.equal(fallbackResponse.headers.get("location"), "https://flowdi.dev/");

console.log("Security headers, anti-framing policy, discovery routes and page output validated.");
