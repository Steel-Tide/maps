#!/usr/bin/env node
/**
 * Write index.json — what the game's *Browse community maps* and the
 * website read: one entry per map under maps/ that passes the check, with
 * its name, description, size, seats, author, last change, download count
 * and a thumbnail (the terrain at up to 64 cells a side), so a page of
 * cards is drawn from this one file and a map is fetched only when it is
 * taken. Run by CI on every push to main and nightly (for the counts); run
 * it yourself to see what the entry for your map will look like.
 *
 *   node tools/build-index.mjs [--counts <file>]
 *
 * `--counts` is the file tools/sync-release.mjs writes: the download count
 * per slug, from the release the maps are attached to. Without it, the
 * counts already in index.json are kept.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMapFile, CUSTOM_MAP_EXT, indexEntryFor, MAP_REGISTRY_DIR, parseMapIndex } from './steel-tide-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const mapsDir = join(root, MAP_REGISTRY_DIR);
const args = process.argv.slice(2);
const countsFile = args.includes('--counts') ? resolve(args[args.indexOf('--counts') + 1]) : null;

function git(...argv) {
  try {
    return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// the counts: the sync's file, else what the last index said
let counts = {};
if (countsFile && existsSync(countsFile)) counts = JSON.parse(readFileSync(countsFile, 'utf8'));
else if (existsSync(join(root, 'index.json'))) {
  const last = parseMapIndex(readFileSync(join(root, 'index.json'), 'utf8'));
  for (const m of last?.maps ?? []) if (m.downloads !== undefined) counts[m.slug] = m.downloads;
}

const maps = [];
for (const file of readdirSync(mapsDir).filter((f) => f.endsWith(CUSTOM_MAP_EXT)).sort()) {
  const path = `${MAP_REGISTRY_DIR}/${file}`;
  const result = checkMapFile(readFileSync(join(mapsDir, file), 'utf8'), file);
  if (!result.ok) {
    console.warn(`skipping ${path}: ${result.error}`);
    continue;
  }
  // whoever first committed it, and when it last changed
  const author = git('log', '--diff-filter=A', '--format=%an', '--', path).split('\n').filter(Boolean).pop() || undefined;
  const updated = git('log', '-1', '--format=%cI', '--', path) || undefined;
  maps.push(indexEntryFor(result.data, result.slug, { author, updated, downloads: counts[result.slug] ?? 0 }));
}

const index = { format: 'steel-tide-map-index', v: 1, generated: new Date().toISOString(), maps };
writeFileSync(join(root, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`index.json: ${maps.length} map${maps.length === 1 ? '' : 's'}`);
