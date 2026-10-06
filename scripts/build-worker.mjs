import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectRoot, "src/index.html");
const manifestPath = resolve(projectRoot, ".openai/hosting.json");
const outputRoot = resolve(projectRoot, "dist");
const workerPath = resolve(outputRoot, "server/index.js");
const outputManifestPath = resolve(outputRoot, ".openai/hosting.json");

const [page, manifest] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(manifestPath, "utf8"),
]);

JSON.parse(manifest);

const inlineStyle = page.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const inlineScript = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

if (!inlineStyle || !inlineScript) {
  throw new Error("Expected exactly one inline style and script block.");
}

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("base64");
const styleHash = sha256(inlineStyle);
const scriptHash = sha256(inlineScript);

const contentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src data:",
  "manifest-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  `script-src 'sha256-${scriptHash}'`,
  `style-src 'sha256-${styleHash}'`,
  "worker-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const workerSource = `const page = ${JSON.stringify(page)};

const securityHeaders = Object.freeze(${JSON.stringify({
  "Content-Security-Policy": contentSecurityPolicy,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "Permissions-Policy": "accelerometer=(), ambient-light-sensor=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-XSS-Protection": "0",
}, null, 2)});

function secureResponse(body, init = {}) {
  const headers = new Headers(securityHeaders);
  for (const [name, value] of Object.entries(init.headers ?? {})) headers.set(name, value);
  return new Response(body, { ...init, headers });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.hostname !== "flowdi.dev") {
      const canonical = new URL("https://flowdi.dev/");
      canonical.pathname = url.pathname;
      canonical.search = url.search;
      return Response.redirect(canonical, 308);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return secureResponse("Method not allowed", {
        status: 405,
        headers: { "allow": "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return secureResponse(request.method === "HEAD" ? null : "Not found", {
        status: 404,
        headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
      });
    }

    return secureResponse(request.method === "HEAD" ? null : page, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=300, stale-while-revalidate=86400",
        "content-type": "text/html; charset=utf-8",
      },
    });
  },
};
`;

await rm(outputRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(dirname(workerPath), { recursive: true }),
  mkdir(dirname(outputManifestPath), { recursive: true }),
]);
await Promise.all([
  writeFile(workerPath, workerSource, "utf8"),
  writeFile(outputManifestPath, manifest, "utf8"),
]);

console.log(`Built secure Worker with CSP hashes for ${sourcePath}`);
