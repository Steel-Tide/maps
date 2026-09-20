#!/usr/bin/env node
/**
 * Check one map file, or every file under maps/: the game's own parser and
 * the registry's rules on top (tools/steel-tide-map.mjs, bundled from the
 * game). Exits non-zero on the first file that fails, naming why.
 *
 *   node tools/check.mjs                  every map
 *   node tools/check.mjs maps/<slug>.steel-tide-map
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMapFile, CUSTOM_MAP_EXT, MAP_REGISTRY_DIR } from './steel-tide-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const mapsDir = join(root, MAP_REGISTRY_DIR);

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => resolve(a))
  : readdirSync(mapsDir).filter((f) => f.endsWith(CUSTOM_MAP_EXT)).sort().map((f) => join(mapsDir, f));

let failed = 0;
const slugs = new Map();
for (const file of files) {
  const rel = file.startsWith(root) ? file.slice(root.length + 1) : file;
  let json;
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
    json = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`✗ ${rel}: ${err.message}`);
    failed++;
    continue;
  }
  const result = checkMapFile(json, file);
  if (!result.ok) {
    console.error(`✗ ${rel}: ${result.error}`);
    failed++;
    continue;
  }
  if (!file.startsWith(mapsDir + '/')) {
    console.error(`✗ ${rel}: a map goes under ${MAP_REGISTRY_DIR}/`);
    failed++;
    continue;
  }
  const other = slugs.get(result.data.name.toLowerCase());
  if (other) {
    console.error(`✗ ${rel}: another map is already called "${result.data.name}" (${other})`);
    failed++;
    continue;
  }
  slugs.set(result.data.name.toLowerCase(), rel);
  const d = result.data;
  const langs = Object.keys(d.translations ?? {});
  console.log(`✓ ${rel}: "${d.name}" ${d.w}×${d.h}, ${d.spawns.length} seats, ${d.deposits.length} deposits${d.decor?.length ? `, ${d.decor.length} props` : ''}${langs.length ? `, also in ${langs.join(', ')}` : ''}`);
}
// every other file under maps/ is a stray
if (!args.length) {
  for (const f of readdirSync(mapsDir)) {
    if (!f.endsWith(CUSTOM_MAP_EXT)) {
      console.error(`✗ ${MAP_REGISTRY_DIR}/${f}: only ${CUSTOM_MAP_EXT} files go here`);
      failed++;
    }
  }
}
if (failed) {
  console.error(`\n${failed} problem${failed === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`\n${files.length} map${files.length === 1 ? '' : 's'} ok`);
