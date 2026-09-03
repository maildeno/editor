/**
 * Deletes every .d.ts that no consumer can reach.
 *
 * unplugin-dts emits a declaration for all ~216 modules under src/, but
 * `exports` only exposes ".", "./element" and "./init" and carries no
 * wildcard, so a consumer's TypeScript can only ever load what those
 * three entries transitively import — about 20 files. The rest ship as
 * dead weight, and some of them import packages that are no longer
 * dependencies at all, so they would fail to compile if anything did
 * reach them.
 *
 * Walks the import graph from the `types` target of each export and
 * removes what it never visits. Runs after both build passes.
 */
import { readFile, readdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const IMPORT_RE =
  /(?:from|import|export)\s*\(?\s*["']([^"']+)["']|\/\/\/\s*<reference\s+path\s*=\s*["']([^"']+)["']/g;

/** Resolve a relative specifier the way TypeScript would, to a .d.ts on disk. */
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base.endsWith(".d.ts") ? base : null,
    `${base}.d.ts`,
    path.join(base, "index.d.ts"),
    // "./Foo.vue" is emitted as "Foo.vue.d.ts"
    base.endsWith(".vue") ? `${base}.d.ts` : null,
    base.replace(/\.js$/, ".d.ts"),
  ].filter(Boolean);
  return candidates.find((c) => existsSync(c)) ?? null;
}

async function allDeclarations(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await allDeclarations(p)));
    else if (e.name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

async function removeEmptyDirs(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) await removeEmptyDirs(path.join(dir, e.name));
  }
  if (dir !== dist && (await readdir(dir)).length === 0) await rm(dir, { recursive: true });
}

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const entries = [];
for (const [name, entry] of Object.entries(pkg.exports ?? {})) {
  const types = typeof entry === "object" ? entry.types : null;
  if (!types) continue;
  const abs = path.resolve(root, types);
  // A missing entry means the dts build silently changed shape. Fail loudly
  // rather than prune against an incomplete graph and delete everything.
  if (!existsSync(abs)) {
    console.error(`[prune-types] exports["${name}"].types missing: ${types}`);
    process.exit(1);
  }
  entries.push(abs);
}

if (entries.length === 0) {
  console.error("[prune-types] no `types` targets in exports — refusing to prune");
  process.exit(1);
}

const keep = new Set();
const stack = [...entries];
while (stack.length) {
  const file = stack.pop();
  if (keep.has(file)) continue;
  keep.add(file);
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    const resolved = resolveSpec(file, spec);
    if (resolved) stack.push(resolved);
  }
}

const all = await allDeclarations(dist);
const drop = all.filter((f) => !keep.has(f));

let freed = 0;
for (const f of drop) {
  freed += (await stat(f)).size;
  await rm(f);
}
await removeEmptyDirs(dist);

console.log(
  `[prune-types] kept ${keep.size}, removed ${drop.length} unreachable ` +
    `declaration files (${(freed / 1024).toFixed(1)} kB)`,
);
