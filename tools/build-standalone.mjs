#!/usr/bin/env node
/**
 * Builds the client into one self-contained HTML file.
 *
 *   npm run build:standalone            ->  dist/allynce.html
 *   npm run build:standalone -- --artifact  ->  dist/allynce.artifact.html
 *
 * The second form emits the same page as a body fragment (title, styles, markup and
 * script, with no document skeleton) for hosts that supply their own wrapper.
 *
 * The result has no external requests at all: styles, modules, game tables and the
 * painted concept plates are inlined, so it opens straight from disk or from any host.
 *
 * The bundler is deliberately small. It resolves the module graph, rewrites the
 * import/export syntax onto a tiny CommonJS-style registry and concatenates in
 * dependency order. That is enough for this codebase — no cycles, no default exports,
 * no dynamic imports — and it keeps the repository free of a build toolchain.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = resolve(ROOT, "web");
const ENTRY = resolve(WEB, "src/main.js");

/* ------------------------------------------------------------ module graph */
const modules = new Map();          // absolute path -> { code, deps }

function load(file) {
  if (modules.has(file)) return;
  const src = readFileSync(file, "utf8");
  const deps = [];
  const code = rewrite(src, file, deps);
  modules.set(file, { code, deps });
  for (const d of deps) load(d);
}

/** Rewrite ES module syntax to the registry form and collect dependencies. */
function rewrite(src, file, deps) {
  const dir = dirname(file);
  const dep = (spec) => {
    const abs = resolve(dir, spec);
    if (!deps.includes(abs)) deps.push(abs);
    return JSON.stringify(id(abs));
  };

  let out = src
    // import * as ns from "./x.js"
    .replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?$/gm,
      (_, ns, spec) => `const ${ns} = __require(${dep(spec)});`)
    // import { a, b as c } from "./x.js"
    .replace(/^import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["'];?$/gm,
      (_, names, spec) => `const {${names.replace(/\bas\b/g, ":")}} = __require(${dep(spec)});`)
    // bare side-effect import
    .replace(/^import\s+["']([^"']+)["'];?$/gm, (_, spec) => `__require(${dep(spec)});`);

  // export { a, b } -> assignments
  out = out.replace(/^export\s+\{([^}]*)\};?$/gm, (_, names) =>
    names.split(",").map((n) => n.trim()).filter(Boolean)
      .map((n) => {
        const [local, exported = local] = n.split(/\s+as\s+/).map((x) => x.trim());
        return `__exports.${exported} = ${local};`;
      }).join(" "));

  // export function/class/const/let -> declaration plus an assignment
  const named = [];
  out = out.replace(/^export\s+(async\s+)?(function|class|const|let|var)\s+(\w+)/gm,
    (_, asyncKw = "", kind, name) => { named.push(name); return `${asyncKw}${kind} ${name}`; });
  if (named.length) out += `\n${named.map((n) => `__exports.${n} = ${n};`).join("\n")}\n`;

  return out;
}

const id = (abs) => "./" + relative(WEB, abs).replace(/\\/g, "/");

load(ENTRY);

/* Depth-first post-order: a module is emitted after everything it needs. */
const ordered = [];
const seen = new Set();
(function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  for (const d of modules.get(file).deps) visit(d);
  ordered.push(file);
})(ENTRY);

const bundle = `
const __registry = {};
const __cache = {};
function __require(name) {
  if (__cache[name]) return __cache[name];
  const __exports = (__cache[name] = {});
  __registry[name](__exports);
  return __exports;
}
${ordered.map((f) => `__registry[${JSON.stringify(id(f))}] = function (__exports) {\n${modules.get(f).code}\n};`).join("\n")}
__require(${JSON.stringify(id(ENTRY))});
`;

/* ------------------------------------------------------------------- assets */
const DATA_FILES = [
  "units/units.json", "units/expansion.json",
  "abilities/abilities.json", "abilities/expansion.json",
  "factions/factions.json", "compositions/platoon.json",
];
const data = Object.fromEntries(DATA_FILES.map((f) =>
  [f, JSON.parse(readFileSync(resolve(ROOT, "data", f), "utf8"))]));

/* Painted plates, as data URIs. Concepts rather than cutouts: the cutouts are five
   times the bytes for a difference the card's art window crops away anyway. */
const units = [...data["units/units.json"], ...data["units/expansion.json"]];
const art = {};
for (const u of units) {
  const p = u.art?.concept;
  if (!p || art[p]) continue;
  try {
    art[p] = `data:image/jpeg;base64,${readFileSync(resolve(ROOT, p)).toString("base64")}`;
  } catch { /* a plate that is not on disk simply falls back to generated art */ }
}

/* ---------------------------------------------------------------- assemble */
const html = readFileSync(resolve(WEB, "index.html"), "utf8");
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)]
  .map((m) => `/* ${m[1]} */\n${readFileSync(resolve(WEB, m[1]), "utf8")}`).join("\n");

const payload =
  `<script>window.__ALLYNCE_DATA__ = ${JSON.stringify(data)};\n` +
  `window.__ALLYNCE_ART__ = ${JSON.stringify(art)};</script>\n` +
  `<script type="module">\n${bundle}\n</script>`;

const artifactMode = process.argv.includes("--artifact");

let out;
if (artifactMode) {
  // Body fragment: the host supplies <!doctype>, <html>, <head> and <body>.
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "ALLYNCE";
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? "";
  out = `<title>${title}</title>\n<style>\n${styles}\n</style>\n`
    + body.replace(/\s*<script type="module" src="[^"]+"><\/script>/, "")
    + `\n${payload}\n`;
} else {
  out = html
    .replace(/\s*<link rel="stylesheet"[^>]*>/g, "")
    .replace("</head>", `<style>\n${styles}\n</style>\n</head>`)
    .replace(/\s*<script type="module" src="[^"]+"><\/script>/, `\n${payload}`);
}

mkdirSync(resolve(ROOT, "dist"), { recursive: true });
const target = resolve(ROOT, artifactMode ? "dist/allynce.artifact.html" : "dist/allynce.html");
writeFileSync(target, out);

console.log(`${relative(ROOT, target)}  ${(out.length / 1_048_576).toFixed(2)} MB`);
console.log(`  ${ordered.length} modules, ${units.length} units, ${Object.keys(art).length} painted plates`);
