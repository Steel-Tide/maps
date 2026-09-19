const MAX_PLAYERS = 8;
var Terrain = /* @__PURE__ */ ((Terrain2) => {
  Terrain2[Terrain2["DeepWater"] = 0] = "DeepWater";
  Terrain2[Terrain2["Water"] = 1] = "Water";
  Terrain2[Terrain2["Sand"] = 2] = "Sand";
  Terrain2[Terrain2["Grass"] = 3] = "Grass";
  Terrain2[Terrain2["Forest"] = 4] = "Forest";
  Terrain2[Terrain2["Mountain"] = 5] = "Mountain";
  Terrain2[Terrain2["Road"] = 6] = "Road";
  Terrain2[Terrain2["Mud"] = 7] = "Mud";
  Terrain2[Terrain2["Marsh"] = 8] = "Marsh";
  Terrain2[Terrain2["Snow"] = 9] = "Snow";
  Terrain2[Terrain2["Rubble"] = 10] = "Rubble";
  Terrain2[Terrain2["Lava"] = 11] = "Lava";
  Terrain2[Terrain2["CliffNorth"] = 12] = "CliffNorth";
  Terrain2[Terrain2["CliffEast"] = 13] = "CliffEast";
  Terrain2[Terrain2["CliffSouth"] = 14] = "CliffSouth";
  Terrain2[Terrain2["CliffWest"] = 15] = "CliffWest";
  return Terrain2;
})(Terrain || {});
({
  /** open pasture — the generator's old, and still most common, ground */
  meadow: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** conifer country: the same ground under a much lower treeline */
  boreal: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** frozen open ground, snow all the way to the water — no beaches this far north */
  tundra: { ground: Terrain.Snow, shore: Terrain.Snow, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** sand from the waterline to the ridges, and nothing growing on it but the palms at an oasis */
  dunes: { ground: Terrain.Sand, shore: Terrain.Sand, hollow: Terrain.Sand, height: Terrain.Mountain },
  /** waterlogged lowland: marsh for a shore and marsh again behind it */
  fen: { ground: Terrain.Grass, shore: Terrain.Marsh, hollow: Terrain.Marsh, height: Terrain.Mountain },
  /** ash flats over old flows, scree at the water and lava in the peaks */
  ashland: { ground: Terrain.Sand, shore: Terrain.Rubble, hollow: Terrain.Rubble, height: Terrain.Lava }
});
const DECOR = {
  pole: { fw: 1, fh: 1, sprite: "d.pole", color: [96, 78, 58], hp: 20, shadow: 6 },
  tower: { fw: 1, fh: 1, sprite: "d.tower", color: [76, 80, 86], hp: 90, shadow: 15 },
  /** a date palm: the one tree that stands on sand, an obstacle a tile wide; three drawings, mixed */
  palm: { fw: 1, fh: 1, sprite: "d.palm", color: [86, 120, 60], hp: 40, variants: 3, shadow: 10 },
  /** a canvas field tent, sandbagged: the camp round a staging post */
  tent: { fw: 2, fh: 2, sprite: "d.tent", color: [128, 116, 84], hp: 90 },
  /** an arched aircraft shelter of concrete: what an airfield keeps beside its strip */
  hangar: { fw: 3, fh: 2, sprite: "d.hangar", color: [112, 108, 100], hp: 260 },
  /** a concrete bunker, half buried, the firing slit facing south */
  bunker: { fw: 2, fh: 2, sprite: "d.bunker", color: [98, 94, 86], hp: 340 },
  /** an oil pumpjack on its concrete pad: the wells the war was over */
  derrick: { fw: 1, fh: 1, sprite: "d.derrick", color: [72, 62, 52], hp: 80 },
  /**
   * A cargo ship going down by the stern, the bow still up and the boxes
   * sliding off her deck: what the open sea is dressed with. Four tiles long
   * and two across, lying north to south with the bow to the north; a hull,
   * so it takes a broadside to finish, and what finishes it is the sea
   * (`razeDecor`). The wash round her is the renderer's (the idle ripple a
   * ship at rest gets, `render/trails.ts`), not the sheet's.
   */
  freighter: { fw: 2, fh: 4, sprite: "d.freighter", water: true, color: [96, 60, 44], hp: 320 },
  /**
   * The same wreck lying east to west, the bow to the west: a kind of its own
   * rather than a variant, since a variant shares its kind's footprint and
   * this one is the footprint turned. Two on a map, one each way, and the
   * sea stops looking stamped.
   */
  freighter2: { fw: 4, fh: 2, sprite: "d.freighter2", water: true, color: [96, 60, 44], hp: 320 }
};
function isDecorKind(k) {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(DECOR, k);
}
function rleEncode(a) {
  const out = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let run = 1;
    while (i + run < a.length && a[i + run] === v && run < 255) run++;
    out.push(run, v);
    i += run;
  }
  let s = "";
  for (let k = 0; k < out.length; k += 4096) {
    s += String.fromCharCode(...out.slice(k, k + 4096));
  }
  return btoa(s);
}
function rleDecode(s, len) {
  return rleDecodeInto(s, new Uint8Array(len));
}
function rleDecodeInto(s, out) {
  const len = out.length;
  if (!s) {
    out.fill(0);
    return out;
  }
  const raw = atob(s);
  let oi = 0;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const run = raw.charCodeAt(i);
    const v = raw.charCodeAt(i + 1);
    out.fill(v, oi, Math.min(len, oi + run));
    oi += run;
  }
  if (oi < len) out.fill(0, oi);
  return out;
}
const CUSTOM_MAP_FORMAT = "steel-tide-map";
const CUSTOM_MAP_VERSION = 1;
const CUSTOM_MAP_EXT = ".steel-tide-map";
const MIN_MAP_SIDE = 16;
const MAX_MAP_SIDE = 256;
const MAX_DEPOSITS = 200;
const MAX_DECOR = 4e3;
const MAX_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 240;
function encodeCustomMap(map, name, description = "") {
  const blurb = cleanDescription(description);
  return {
    format: CUSTOM_MAP_FORMAT,
    v: CUSTOM_MAP_VERSION,
    name: cleanName(name),
    ...blurb ? { description: blurb } : {},
    w: map.w,
    h: map.h,
    terrain: rleEncode(map.terrain),
    deposits: map.deposits.map((d) => ({ x: d.x, y: d.y })),
    spawns: map.spawns.map((s) => ({ x: s.x, y: s.y })),
    ...map.decor?.length ? { decor: map.decor.map((d) => ({ kind: d.kind, x: d.x, y: d.y })) } : {}
  };
}
function customMapToGameMap(data) {
  return {
    nameKey: data.name,
    w: data.w,
    h: data.h,
    terrain: rleDecode(data.terrain, data.w * data.h),
    deposits: data.deposits.map((d) => ({ x: d.x, y: d.y })),
    spawns: data.spawns.map((s) => ({ x: s.x, y: s.y })),
    ...data.decor?.length ? { decor: data.decor.map((d) => ({ kind: d.kind, x: d.x, y: d.y })) } : {}
  };
}
function readDecor(list, w, h) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad props";
  if (list.length > MAX_DECOR) return "too many props";
  const taken = new Uint8Array(w * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad props";
    const { kind, x, y } = item;
    if (!isDecorKind(kind)) return "the map uses a prop this build does not know";
    const def = DECOR[kind];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + def.fw > w || y + def.fh > h) {
      return "a prop lies outside the map";
    }
    const tx = x, ty = y;
    let free = true;
    for (let yy = ty; yy < ty + def.fh && free; yy++) {
      for (let xx = tx; xx < tx + def.fw; xx++) if (taken[yy * w + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = ty; yy < ty + def.fh; yy++) for (let xx = tx; xx < tx + def.fw; xx++) taken[yy * w + xx] = 1;
    out.push({ kind, x: tx, y: ty });
  }
  return out;
}
function cleanName(name) {
  const s = name.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return s || "Untitled";
}
function cleanDescription(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}
function parseCustomMap(json) {
  if (typeof json !== "string" || json.length === 0 || json.length > 4 * 1024 * 1024) {
    return { ok: false, error: "the file is empty or too large" };
  }
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "not a map file" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "not a map file" };
  const r = raw;
  if (r.format !== CUSTOM_MAP_FORMAT) return { ok: false, error: "not a Steel Tide map" };
  if (r.v !== CUSTOM_MAP_VERSION) return { ok: false, error: `unsupported map version ${String(r.v)}` };
  if (!Number.isInteger(r.w) || !Number.isInteger(r.h) || r.w < MIN_MAP_SIDE || r.h < MIN_MAP_SIDE || r.w > MAX_MAP_SIDE || r.h > MAX_MAP_SIDE) {
    return { ok: false, error: `the map must be ${MIN_MAP_SIDE}–${MAX_MAP_SIDE} tiles a side` };
  }
  const w = r.w, h = r.h;
  if (typeof r.terrain !== "string" || r.terrain.length > 2 * 1024 * 1024) return { ok: false, error: "bad terrain data" };
  let terrain;
  try {
    terrain = rleDecode(r.terrain, w * h);
  } catch {
    return { ok: false, error: "bad terrain data" };
  }
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] > Terrain.CliffWest) return { ok: false, error: "the map uses a terrain this build does not know" };
  }
  const points2 = (list, max, what) => {
    if (list === void 0) return [];
    if (!Array.isArray(list)) return `bad ${what}`;
    if (list.length > max) return `too many ${what}`;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const p of list) {
      if (!p || typeof p !== "object") return `bad ${what}`;
      const { x, y } = p;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w || y >= h) {
        return `a ${what.replace(/s$/, "")} lies outside the map`;
      }
      const key = y * w + x;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, y });
    }
    return out;
  };
  const deposits = points2(r.deposits, MAX_DEPOSITS, "deposits");
  if (typeof deposits === "string") return { ok: false, error: deposits };
  const spawns = points2(r.spawns, MAX_PLAYERS, "spawns");
  if (typeof spawns === "string") return { ok: false, error: spawns };
  const decor = readDecor(r.decor, w, h);
  if (typeof decor === "string") return { ok: false, error: decor };
  const description = cleanDescription(typeof r.description === "string" ? r.description : "");
  return {
    ok: true,
    data: {
      format: CUSTOM_MAP_FORMAT,
      v: CUSTOM_MAP_VERSION,
      name: cleanName(typeof r.name === "string" ? r.name : ""),
      ...description ? { description } : {},
      w,
      h,
      terrain: rleEncode(terrain),
      deposits,
      spawns,
      ...decor.length ? { decor } : {}
    }
  };
}
const MAP_REGISTRY_REPO = "rivertwilight/steel-tide-maps";
const MAP_REGISTRY_WEB = `https://github.com/${MAP_REGISTRY_REPO}`;
const MAP_REGISTRY_URL = `https://raw.githubusercontent.com/${MAP_REGISTRY_REPO}/main/index.json`;
const MAP_REGISTRY_DIR = "maps";
const MAP_REGISTRY_RELEASE = "registry";
const MAP_REGISTRY_COUNTS_URL = `https://api.github.com/repos/${MAP_REGISTRY_REPO}/releases/tags/${MAP_REGISTRY_RELEASE}`;
function mapFileUrl(slug) {
  return `https://raw.githubusercontent.com/${MAP_REGISTRY_REPO}/main/${MAP_REGISTRY_DIR}/${slug}${CUSTOM_MAP_EXT}`;
}
function mapCountUrl(slug) {
  return `${MAP_REGISTRY_WEB}/releases/download/${MAP_REGISTRY_RELEASE}/${slug}${CUSTOM_MAP_EXT}`;
}
function mapPageUrl(slug) {
  return `${MAP_REGISTRY_WEB}/blob/main/${MAP_REGISTRY_DIR}/${slug}${CUSTOM_MAP_EXT}`;
}
const PUBLISH_URL_BUDGET = 6e3;
function mapPublishUrl(slug, contents) {
  const base = `${MAP_REGISTRY_WEB}/new/main/${MAP_REGISTRY_DIR}?filename=${encodeURIComponent(slug + CUSTOM_MAP_EXT)}`;
  if (contents === void 0) return base;
  const url = `${base}&value=${encodeURIComponent(contents)}`;
  return url.length <= PUBLISH_URL_BUDGET ? url : base;
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = MAX_NAME_LENGTH;
function slugify(name) {
  const flat = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = flat.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  if (slug) return slug;
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return `map-${(h >>> 0).toString(16).padStart(8, "0").slice(0, 6)}`;
}
const THUMB_MAX = 64;
function thumbOf(data) {
  const scale = Math.min(1, THUMB_MAX / Math.max(data.w, data.h));
  const w = Math.max(1, Math.round(data.w * scale)), h = Math.max(1, Math.round(data.h * scale));
  const tiles = rleDecode(data.terrain, data.w * data.h);
  const kinds = Terrain.CliffWest + 1;
  const votes = new Uint16Array(w * h * kinds);
  for (let y = 0; y < data.h; y++) {
    const cy = Math.min(h - 1, Math.floor(y * h / data.h));
    for (let x = 0; x < data.w; x++) {
      const cx = Math.min(w - 1, Math.floor(x * w / data.w));
      votes[(cy * w + cx) * kinds + tiles[y * data.w + x]]++;
    }
  }
  const terrain = new Uint8Array(w * h);
  for (let c = 0; c < w * h; c++) {
    let best = 0;
    for (let k = 1; k < kinds; k++) if (votes[c * kinds + k] > votes[c * kinds + best]) best = k;
    terrain[c] = best;
  }
  const at = (p) => ({
    x: Math.min(w - 1, Math.floor(p.x * w / data.w)),
    y: Math.min(h - 1, Math.floor(p.y * h / data.h))
  });
  return { w, h, terrain: rleEncode(terrain), spawns: data.spawns.map(at), deposits: data.deposits.map(at) };
}
function thumbToMap(thumb, name) {
  return {
    nameKey: name,
    w: thumb.w,
    h: thumb.h,
    terrain: rleDecode(thumb.terrain, thumb.w * thumb.h),
    deposits: thumb.deposits.map((d) => ({ ...d })),
    spawns: thumb.spawns.map((s) => ({ ...s }))
  };
}
function indexEntryFor(data, slug, extra = {}) {
  return {
    slug,
    name: data.name,
    ...data.description ? { description: data.description } : {},
    ...extra.author ? { author: extra.author } : {},
    w: data.w,
    h: data.h,
    spawns: data.spawns.length,
    deposits: data.deposits.length,
    decor: data.decor?.length ?? 0,
    ...extra.updated ? { updated: extra.updated } : {},
    ...extra.downloads !== void 0 ? { downloads: extra.downloads } : {},
    thumb: thumbOf(data)
  };
}
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function points(list, w, h) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const p of list) {
    if (!isPlainObject(p) || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
    const x = p.x, y = p.y;
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    out.push({ x, y });
  }
  return out;
}
function parseMapIndex(json) {
  let raw = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(raw) || raw.format !== "steel-tide-map-index" || !Array.isArray(raw.maps)) return null;
  const maps = [];
  for (const m of raw.maps) {
    if (!isPlainObject(m) || typeof m.slug !== "string" || !SLUG_RE.test(m.slug) || typeof m.name !== "string") continue;
    if (!Number.isInteger(m.w) || !Number.isInteger(m.h) || !Number.isInteger(m.spawns)) continue;
    const t = m.thumb;
    if (!isPlainObject(t) || !Number.isInteger(t.w) || !Number.isInteger(t.h) || typeof t.terrain !== "string") continue;
    const tw = t.w, th = t.h;
    if (tw < 1 || th < 1 || tw > THUMB_MAX || th > THUMB_MAX) continue;
    let terrain;
    try {
      terrain = rleDecode(t.terrain, tw * th);
    } catch {
      continue;
    }
    if (terrain.some((v) => v > Terrain.CliffWest)) continue;
    const spawns = points(t.spawns, tw, th), deposits = points(t.deposits, tw, th);
    if (!spawns || !deposits) continue;
    maps.push({
      slug: m.slug,
      name: cleanName(m.name),
      ...typeof m.description === "string" && m.description ? { description: cleanDescription(m.description) } : {},
      ...typeof m.author === "string" && m.author ? { author: m.author.slice(0, 80) } : {},
      w: m.w,
      h: m.h,
      spawns: m.spawns,
      deposits: Number.isInteger(m.deposits) ? m.deposits : 0,
      decor: Number.isInteger(m.decor) ? m.decor : 0,
      ...typeof m.updated === "string" ? { updated: m.updated } : {},
      ...Number.isInteger(m.downloads) ? { downloads: m.downloads } : {},
      thumb: { w: tw, h: th, terrain: t.terrain, spawns, deposits }
    });
  }
  return { format: "steel-tide-map-index", v: 1, generated: typeof raw.generated === "string" ? raw.generated : "", maps };
}
function mapMatches(entry, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${entry.name}
${entry.description ?? ""}
${entry.author ?? ""}
${entry.slug}`.toLowerCase();
  return words.every((word) => hay.includes(word));
}
const MAX_MAP_FILE_BYTES = 512 * 1024;
function checkMapFile(json, filename) {
  if (json.length > MAX_MAP_FILE_BYTES) return { ok: false, reason: "size", error: `the file is over ${MAX_MAP_FILE_BYTES / 1024} KB` };
  const parsed = parseCustomMap(json);
  if (!parsed.ok) return { ok: false, reason: "parse", error: parsed.error };
  const data = parsed.data;
  if (data.name === "Untitled") return { ok: false, reason: "name", error: "the map needs a name of its own" };
  if (!data.description) return { ok: false, reason: "description", error: "the map needs a description: a line or two on what kind of fight it is" };
  if (data.spawns.length < 2) return { ok: false, reason: "spawns", error: "a map needs at least two spawn points to be played" };
  let slug = slugify(data.name);
  if (filename !== void 0) {
    const base = filename.replace(/^.*[\\/]/, "");
    if (!base.endsWith(CUSTOM_MAP_EXT)) return { ok: false, reason: "slug", error: `the file must be named <slug>${CUSTOM_MAP_EXT}` };
    slug = base.slice(0, -CUSTOM_MAP_EXT.length);
    if (!SLUG_RE.test(slug) || slug.length > MAX_SLUG_LENGTH) return { ok: false, reason: "slug", error: `"${slug}" is not a slug: lower-case letters, digits and single hyphens` };
  }
  return { ok: true, data, slug };
}
export {
  CUSTOM_MAP_EXT,
  CUSTOM_MAP_FORMAT,
  CUSTOM_MAP_VERSION,
  MAP_REGISTRY_COUNTS_URL,
  MAP_REGISTRY_DIR,
  MAP_REGISTRY_RELEASE,
  MAP_REGISTRY_REPO,
  MAP_REGISTRY_URL,
  MAP_REGISTRY_WEB,
  MAX_DESCRIPTION_LENGTH,
  MAX_MAP_FILE_BYTES,
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  SLUG_RE,
  THUMB_MAX,
  checkMapFile,
  cleanDescription,
  cleanName,
  customMapToGameMap,
  encodeCustomMap,
  indexEntryFor,
  mapCountUrl,
  mapFileUrl,
  mapMatches,
  mapPageUrl,
  mapPublishUrl,
  parseCustomMap,
  parseMapIndex,
  slugify,
  thumbOf,
  thumbToMap
};
