# steel-tide-maps

The public registry of maps for [Steel Tide](https://steelti.de), the browser
RTS. A map is one `.steel-tide-map` file, painted in the game's **Map Editor**
and played exactly as painted, and every file under `maps/` here is listed in
the game under *Browse community maps* on the Conquest, Breakthrough and
multiplayer setup screens.

- **Play one:** in the game, on a setup screen's map grid, *Browse community
  maps* → pick it. Or download the file from `maps/` and *Upload map…*.
- **Make one:** the game's Map Editor (home menu → *Map Editor*). Give it a
  name and a description, at least two spawn points, and *Export*.
- **Publish one:** the editor's **Publish** button copies the file and opens a
  new-file page here with the name filled in; *Propose new file* opens the
  pull request. Or fork, add `maps/<slug>.steel-tide-map`, run the check,
  open a pull request yourself.

## Adding a map

```
maps/<slug>.steel-tide-map    the file the editor exports; <slug> is lower-case
                              letters, digits and single hyphens (two-fords)
```

```sh
node tools/check.mjs maps/<slug>.steel-tide-map   # what the game will say about it
node tools/build-index.mjs                          # what its entry in the index will be
```

The check is the game's own parser plus what the registry asks: a name of its
own (not *Untitled*), a description (a line or two on what kind of fight it
is: it is what players read beside the map), at least two spawn points, a
slug for a filename, under 512 KB, and a name no other map here has. CI runs
the same check on every pull request; once merged, `index.json` is rebuilt on
`main` and the map is in the game.

To update a map, replace the file. Its download count carries over.

## Download counts

There is no database. Every map is attached as an asset to the rolling
[`registry` release](../../releases/tag/registry), GitHub counts downloads of
release assets, and the game fetches a map's asset URL when a player takes
it. `tools/sync-release.mjs` keeps the release in step with `maps/` (a new
file is uploaded, a changed one replaced with its count carried, a removed one
taken down) and `tools/build-index.mjs` bakes the counts into `index.json`,
nightly and on every push. The release is not for people: the game reads the
file from `main`.

## What is here

| Path | What |
| --- | --- |
| `maps/<slug>.steel-tide-map` | one map each |
| `index.json` | what the game and the website read: name, description, size, seats, author, downloads and a thumbnail per map; generated, never edited by hand |
| `tools/check.mjs` | validate one map or all of them |
| `tools/build-index.mjs` | rebuild `index.json` (CI does this on `main`) |
| `tools/sync-release.mjs` | the release the maps are counted on (CI) |
| `tools/steel-tide-map.mjs` | the game's own map code: the parser, the check, the index entry and its thumbnail, bundled from the game repository; do not edit here |

## The file

A `.steel-tide-map` is JSON: `format` (`steel-tide-map`), `v` (`1`), `name`,
`description`, `w` and `h` in tiles (16 to 256 a side), `terrain` (the tile
grid run-length coded, base64), `deposits` and `spawns` (tile coordinates),
and `decor` (the props standing on it). The editor writes it; nothing needs
to be written by hand.

## Licence

The tooling is MIT. Each map is published under CC-BY-4.0 and belongs to its
author. By opening a pull request you confirm the map is yours to publish
under that licence.
