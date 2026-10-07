import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const html = await readFile(resolve(projectRoot, "src/index.html"), "utf8");

assert.match(html, /^<!doctype html>/i, "Document must start with an HTML doctype");
assert.match(html, /<html lang="en">/, "English must remain the default language");
assert.match(html, /<meta charset="utf-8">/, "UTF-8 declaration is required");
assert.match(html, /<meta name="viewport"/, "Responsive viewport metadata is required");
assert.match(html, /<meta name="referrer" content="no-referrer">/, "Referrer metadata is required");
assert.match(html, /<link rel="canonical" href="https:\/\/flowdi\.dev\/">/, "Canonical URL must use HTTPS on flowdi.dev");

const forbiddenMarkup = [
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<form\b/i,
  /\son[a-z]+\s*=/i,
  /\ssrcdoc\s*=/i,
];
for (const pattern of forbiddenMarkup) {
  assert.doesNotMatch(html, pattern, `Forbidden markup detected: ${pattern}`);
}

const forbiddenScriptSinks = [
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /document\.write\s*\(/,
  /insertAdjacentHTML\s*\(/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
];
for (const pattern of forbiddenScriptSinks) {
  assert.doesNotMatch(html, pattern, `Unsafe script sink detected: ${pattern}`);
}

const resourceAttributes = [...html.matchAll(/\s(?:src|href|action)="([^"]+)"/gi)].map((match) => match[1]);
for (const value of resourceAttributes) {
  const allowed = value.startsWith("#") || value.startsWith("data:") || value === "https://flowdi.dev/";
  assert.ok(allowed, `Unexpected external resource or navigation target: ${value}`);
}

console.log("Source audit passed: no external resources, unsafe markup or dynamic HTML sinks.");
