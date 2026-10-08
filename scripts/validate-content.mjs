import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const sourcePath = resolve(fileURLToPath(new URL("..", import.meta.url)), "src/index.html");
const html = await readFile(sourcePath, "utf8");

const collect = (pattern) => [...html.matchAll(pattern)].map((match) => match[1]);

const ids = collect(/\sid="([^"]+)"/g);
assert.equal(new Set(ids).size, ids.length, "Every id must be unique");

for (const target of collect(/\shref="#([^"]+)"/g)) {
  assert(ids.includes(target), `Missing anchor target: #${target}`);
}

const translationMatch = html.match(/const translations = (\{[\s\S]*?\n    \});/);
assert(translationMatch, "Could not locate the translations object");
const translations = vm.runInNewContext(`(${translationMatch[1]})`, Object.create(null), { timeout: 100 });

const englishKeys = Object.keys(translations.en).sort();
const germanKeys = Object.keys(translations.de).sort();
assert.deepEqual(germanKeys, englishKeys, "English and German must define the same translation keys");

for (const key of englishKeys) {
  const englishValue = translations.en[key];
  const germanValue = translations.de[key];
  assert.equal(Array.isArray(germanValue), Array.isArray(englishValue), `Translation type mismatch: ${key}`);
  if (Array.isArray(englishValue)) {
    assert.equal(germanValue.length, englishValue.length, `Translation array length mismatch: ${key}`);
    assert(englishValue.every((value) => typeof value === "string" && value.trim()), `Blank English translation: ${key}`);
    assert(germanValue.every((value) => typeof value === "string" && value.trim()), `Blank German translation: ${key}`);
  } else {
    assert.equal(typeof englishValue, "string", `English translation must be text: ${key}`);
    assert.equal(typeof germanValue, "string", `German translation must be text: ${key}`);
    assert(englishValue.trim(), `Blank English translation: ${key}`);
    assert(germanValue.trim(), `Blank German translation: ${key}`);
  }
}

const referencedKeys = new Set([
  ...collect(/\sdata-i18n="([^"]+)"/g),
  ...collect(/\sdata-i18n-rich="([^"]+)"/g),
  ...collect(/\sdata-i18n-aria="([^"]+)"/g),
]);
for (const key of referencedKeys) {
  assert(key in translations.en, `Unknown translation key in markup: ${key}`);
}

assert.match(html, /<link rel="canonical" href="https:\/\/flowdi\.dev\/">/);
assert.match(html, /<meta property="og:title"/);
assert.match(html, /<meta name="twitter:card" content="summary">/);

console.log(`Content validated: ${ids.length} unique IDs, ${referencedKeys.size} referenced translation keys and ${englishKeys.length} bilingual entries.`);
