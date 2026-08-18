#!/usr/bin/env node
// Fails the build when a route's own initial JS/CSS payload regresses past
// the performance budgets set by issue #38. Reads dist/.vite/manifest.json
// (requires vite.config.ts `build.manifest: true`) to distinguish each
// route's own chunk graph from chunks already paid for by the eager shell.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const distDir = path.resolve("dist");
const manifestPath = path.join(distDir, ".vite", "manifest.json");

const JS_BUDGET = 150 * 1024;
const JS_WARN = 120 * 1024;
const CSS_BUDGET = 50 * 1024;
const IMAGE_BUDGET = 250 * 1024;

if (!existsSync(manifestPath)) {
  console.error(`Manifest not found at ${manifestPath}. Run "npm run build" first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function gzipSize(relFile) {
  const bytes = readFileSync(path.join(distDir, relFile));
  return gzipSync(bytes).length;
}

function entryKey() {
  const key = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (!key) throw new Error("No entry chunk found in manifest.");
  return key;
}

// Transitive closure of a chunk's *static* imports (not dynamicImports),
// which is exactly what the browser must fetch before that chunk runs.
function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  const chunk = manifest[key];
  if (!chunk) return seen;
  for (const imp of chunk.imports ?? []) closure(imp, seen);
  return seen;
}

function chunkFiles(keys) {
  const js = new Set();
  const css = new Set();
  for (const key of keys) {
    const chunk = manifest[key];
    if (!chunk) continue;
    js.add(chunk.file);
    for (const c of chunk.css ?? []) css.add(c);
  }
  return { js, css };
}

function sumGzip(files) {
  let total = 0;
  for (const f of files) total += gzipSize(f);
  return total;
}

const entry = entryKey();
const initialKeys = closure(entry);
const initial = chunkFiles(initialKeys);
const initialJsBytes = sumGzip(initial.js);
const initialCssBytes = sumGzip(initial.css);

let failed = false;

console.log("== Initial (Shell + Home) payload ==");
report("JS", initialJsBytes, JS_BUDGET, JS_WARN);
report("CSS", initialCssBytes, CSS_BUDGET, CSS_BUDGET * 0.8);

console.log("\n== Per-route additional payload (beyond the eager shell) ==");
const entryChunk = manifest[entry];
for (const routeKey of entryChunk.dynamicImports ?? []) {
  const routeClosure = closure(routeKey);
  // Only count what the shell doesn't already pay for.
  const ownKeys = [...routeClosure].filter((k) => !initialKeys.has(k));
  const own = chunkFiles(ownKeys);
  const jsBytes = sumGzip(own.js);
  const cssBytes = sumGzip(own.css);
  console.log(`\n${routeKey}`);
  report("JS", jsBytes, JS_BUDGET, JS_WARN);
  if (cssBytes > 0) report("CSS", cssBytes, CSS_BUDGET, CSS_BUDGET * 0.8);
}

console.log("\n== Raster image assets ==");
const assetsDir = path.join(distDir, "assets");
if (existsSync(assetsDir)) {
  for (const file of readdirSync(assetsDir)) {
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file)) continue;
    const size = statSync(path.join(assetsDir, file)).size;
    const ok = size <= IMAGE_BUDGET;
    if (!ok) failed = true;
    console.log(
      `  ${ok ? "OK  " : "FAIL"} ${file}: ${(size / 1024).toFixed(2)} KiB (budget ${(IMAGE_BUDGET / 1024).toFixed(0)} KiB)`,
    );
  }
}

function report(label, bytes, budget, warn) {
  const kib = (bytes / 1024).toFixed(2);
  if (bytes > budget) {
    failed = true;
    console.log(`  FAIL ${label}: ${kib} KiB (budget ${(budget / 1024).toFixed(0)} KiB)`);
  } else if (bytes > warn) {
    console.log(`  WARN ${label}: ${kib} KiB (budget ${(budget / 1024).toFixed(0)} KiB, warn ${(warn / 1024).toFixed(0)} KiB)`);
  } else {
    console.log(`  OK   ${label}: ${kib} KiB (budget ${(budget / 1024).toFixed(0)} KiB)`);
  }
}

if (failed) {
  console.error("\nBundle budget check FAILED.");
  process.exit(1);
}
console.log("\nBundle budget check passed.");
