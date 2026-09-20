# steel-tide-maps

The public registry of maps for Steel Tide, the browser RTS. One map is one
`maps/<slug>.steel-tide-map` file, produced by the game's Map Editor; the
registry holds the files, checks them and indexes them. Nothing here is
written by hand except this text.

## Working here

- `node tools/check.mjs [maps/<slug>.steel-tide-map]` validates a map, or
  all of them: the game's parser, plus a name of its own, a description, at
  least two spawn points, a slug for a filename, under 512 KB, and no other
  map with the same name.
- `node tools/build-index.mjs` rebuilds `index.json`. CI does this on every
  push to `main` (and nightly, for the download counts); do not commit an
  `index.json` you built unless asked to.
- `tools/steel-tide-map.mjs` is generated from the game repository
  (`pnpm -C game/core maptools` there). Never edit it here.
- `tools/sync-release.mjs` needs `gh` signed in; CI runs it. It keeps the
  `registry` release's assets in step with `maps/`, which is how downloads
  are counted.

## Adding a map

1. Export it from the game's Map Editor with a name and a description, and
   at least two spawn points. The editor's *Translations* put the same two
   in other languages into the file (`translations`, by language code);
   the game shows a player the one their interface is in.
2. Save it as `maps/<slug>.steel-tide-map`, the slug lower-case letters,
   digits and single hyphens.
3. `node tools/check.mjs maps/<slug>.steel-tide-map`.
4. Open a pull request. Updating a map is replacing the file.
