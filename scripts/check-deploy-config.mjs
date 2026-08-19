#!/usr/bin/env node
// Validates the repository-owned Vercel deployment configuration (issue #40)
// against the actual `npm run build` output, without calling the live
// Cybersoft backend:
//   1. vercel.json declares the expected install/build/output/rewrite shape.
//   2. Serving dist/ with the same "static file, else index.html" precedence
//      Vercel applies resolves representative canonical deep links to the
//      SPA shell (200, contains the built entry script + #root mount point).
//   3. Every local (non-CDN) asset referenced by dist/index.html exists on
//      disk and is served as a literal static file (not silently rewritten
//      to index.html because of a routing mistake).
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distDir = path.join(root, "dist");
const vercelConfigPath = path.join(root, "vercel.json");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK   ${message}`);
}

// --- 1. vercel.json shape -------------------------------------------------

if (!existsSync(vercelConfigPath)) {
  fail(`vercel.json not found at ${vercelConfigPath}.`);
  process.exit(1);
}

const vercelConfig = JSON.parse(readFileSync(vercelConfigPath, "utf8"));

const expectations = [
  ["installCommand", "npm ci"],
  ["buildCommand", "npm run build"],
  ["outputDirectory", "dist"],
  ["framework", "vite"],
];

for (const [key, expected] of expectations) {
  if (vercelConfig[key] === expected) {
    ok(`vercel.json ${key} = "${expected}"`);
  } else {
    fail(`vercel.json ${key} is "${vercelConfig[key]}", expected "${expected}".`);
  }
}

const rewrite = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites[0] : undefined;
if (rewrite?.source === "/(.*)" && rewrite?.destination === "/index.html") {
  ok("vercel.json declares a catch-all SPA rewrite to /index.html");
} else {
  fail("vercel.json is missing the catch-all SPA rewrite (source \"/(.*)\" -> \"/index.html\").");
}

// --- 2 & 3 need a real build ------------------------------------------------

if (!existsSync(distDir)) {
  fail(`${distDir} not found. Run "npm run build" first.`);
  process.exit(1);
}

const indexHtmlPath = path.join(distDir, "index.html");
if (!existsSync(indexHtmlPath)) {
  fail(`${indexHtmlPath} not found. Run "npm run build" first.`);
  process.exit(1);
}

const indexHtml = readFileSync(indexHtmlPath, "utf8");

// Static-file-first, else index.html — the same precedence Vercel applies
// before falling back to a rewrite for a project's output directory.
function resolveRequestPath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const candidate = path.join(distDir, decoded);
  if (candidate.startsWith(distDir) && existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  return indexHtmlPath;
}

const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url ?? "/");
  const body = readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
  });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  // Representative canonical deep links: static routes, a single dynamic
  // param, a nested dynamic param, and the Administrator wildcard area.
  const deepLinks = [
    "/",
    "/services",
    "/services/demo-service",
    "/services/demo-service/hire",
    "/categories/demo-category",
    "/hired-services",
    "/profile",
    "/login",
    "/register",
    "/admin/services",
  ];

  for (const deepLink of deepLinks) {
    const response = await fetch(`${baseUrl}${deepLink}`);
    const body = await response.text();
    const isShell = body.includes('<div id="root">') && body.includes('src="/assets/');
    if (response.status === 200 && isShell) {
      ok(`deep link ${deepLink} resolves to the SPA shell`);
    } else {
      fail(`deep link ${deepLink} did not resolve to the SPA shell (status ${response.status}).`);
    }
  }

  // Every local asset the built shell references must exist on disk and be
  // served as itself, not silently rewritten to index.html.
  const assetRefs = [...indexHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((ref) => !ref.startsWith("//"));

  if (assetRefs.length === 0) {
    fail("No local asset references found in dist/index.html.");
  }

  for (const assetRef of assetRefs) {
    const response = await fetch(`${baseUrl}${assetRef}`);
    const contentType = response.headers.get("content-type") ?? "";
    const isRealAsset = response.status === 200 && !contentType.includes("text/html");
    if (isRealAsset) {
      ok(`asset ${assetRef} is served as a static file`);
    } else {
      fail(`asset ${assetRef} did not resolve to a real static file (status ${response.status}).`);
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (process.exitCode) {
  console.error("\nDeployment configuration validation failed.");
} else {
  console.log("\nDeployment configuration validation passed.");
}
