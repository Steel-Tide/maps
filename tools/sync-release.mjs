#!/usr/bin/env node
/**
 * Keep the rolling `registry` release in step with maps/ — the download
 * counter that costs nothing: GitHub counts downloads of a release asset,
 * so every map is attached to one release as an asset, the game fetches the
 * asset URL when a player takes the map, and the count is read back off the
 * release. Nothing here is for people: the release is never "latest" and
 * its notes say so.
 *
 *   node tools/sync-release.mjs --out .counts.json
 *
 * Needs `gh` signed in (CI's GITHUB_TOKEN). A map new to the release is
 * uploaded; one whose file changed is replaced — GitHub cannot swap an
 * asset's bytes, and a re-upload starts the count over, so the old count is
 * carried in `counts.json`, an asset of the release's own, and added back.
 * A map gone from maps/ has its asset removed. What is written to `--out`
 * is the count per slug, which tools/build-index.mjs bakes into the index.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_MAP_EXT, MAP_REGISTRY_DIR, MAP_REGISTRY_RELEASE, MAP_REGISTRY_REPO } from './steel-tide-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const mapsDir = join(root, MAP_REGISTRY_DIR);
const args = process.argv.slice(2);
const outFile = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1]) : join(root, '.counts.json');
const COUNTS = 'counts.json';
const INDEX = 'index.json';

function gh(...argv) {
  return execFileSync('gh', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// the release, made if it is not there
let release;
try {
  release = JSON.parse(gh('api', `repos/${MAP_REGISTRY_REPO}/releases/tags/${MAP_REGISTRY_RELEASE}`));
} catch {
  console.log(`creating the ${MAP_REGISTRY_RELEASE} release`);
  gh('release', 'create', MAP_REGISTRY_RELEASE, '--repo', MAP_REGISTRY_REPO, '--title', 'Registry', '--latest=false',
    '--notes', 'The maps of this registry as release assets, so GitHub counts their downloads for the index. Not a release for people: get a map from the game, under *Browse community maps*, or from `maps/`.');
  release = JSON.parse(gh('api', `repos/${MAP_REGISTRY_REPO}/releases/tags/${MAP_REGISTRY_RELEASE}`));
}
const assets = new Map(release.assets.map((a) => [a.name, a]));

// the carried counts and the hashes of what is up there
const work = mkdtempSync(join(tmpdir(), 'steel-tide-maps-'));
let carried = { carried: {}, sha: {} };
if (assets.has(COUNTS)) {
  gh('release', 'download', MAP_REGISTRY_RELEASE, '--repo', MAP_REGISTRY_REPO, '--pattern', COUNTS, '--dir', work, '--clobber');
  try {
    const read = JSON.parse(readFileSync(join(work, COUNTS), 'utf8'));
    if (read && typeof read === 'object') carried = { carried: read.carried ?? {}, sha: read.sha ?? {} };
  } catch {
    /* a counts file that does not read starts the carry over from nothing */
  }
}

const upload = (file) => gh('release', 'upload', MAP_REGISTRY_RELEASE, file, '--repo', MAP_REGISTRY_REPO, '--clobber');
const remove = (name) => gh('release', 'delete-asset', MAP_REGISTRY_RELEASE, name, '--repo', MAP_REGISTRY_REPO, '--yes');

const counts = {};
const files = readdirSync(mapsDir).filter((f) => f.endsWith(CUSTOM_MAP_EXT)).sort();
for (const file of files) {
  const slug = file.slice(0, -CUSTOM_MAP_EXT.length);
  const path = join(mapsDir, file);
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  const asset = assets.get(file);
  const known = carried.sha[slug];
  if (asset && (known === sha || known === undefined)) {
    // up there and unchanged (or from before hashes were kept: taken as is)
    counts[slug] = (carried.carried[slug] ?? 0) + asset.download_count;
  } else {
    if (asset) {
      // changed: the old asset's count goes into the carry before the asset goes
      carried.carried[slug] = (carried.carried[slug] ?? 0) + asset.download_count;
      console.log(`replacing ${file} (${asset.download_count} downloads carried)`);
      remove(file);
    } else {
      console.log(`uploading ${file}`);
    }
    upload(path);
    counts[slug] = carried.carried[slug] ?? 0;
  }
  carried.sha[slug] = sha;
  assets.delete(file);
}
// whatever is still on the release and not in maps/ is gone from the registry
for (const name of assets.keys()) {
  if (name === COUNTS || name === INDEX) continue;
  console.log(`removing ${name}`);
  remove(name);
}
for (const slug of Object.keys(carried.sha)) if (!files.includes(slug + CUSTOM_MAP_EXT)) delete carried.sha[slug];

const countsPath = join(work, COUNTS);
writeFileSync(countsPath, JSON.stringify(carried, null, 2) + '\n');
upload(countsPath);
writeFileSync(outFile, JSON.stringify(counts, null, 2) + '\n');
rmSync(work, { recursive: true, force: true });
console.log(`${files.length} map${files.length === 1 ? '' : 's'} on the release; counts in ${outFile}`);
