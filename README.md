# geohash-kit

**Nostr:** [`npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`](https://njump.me/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)

**The modern TypeScript geohash toolkit — encode, decode, cover polygons, and discover location-based Nostr events.**

[![npm](https://img.shields.io/npm/v/geohash-kit)](https://www.npmjs.com/package/geohash-kit)
[![licence](https://img.shields.io/npm/l/geohash-kit)](https://github.com/forgesworn/geohash-kit/blob/main/LICENSE)
![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-native-blue)
[![Nostr](https://img.shields.io/badge/Nostr-Zap%20me-purple)](https://primal.net/p/npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/TheCryptoDonkey?logo=githubsponsors&color=ea4aaa&label=Sponsor)](https://github.com/sponsors/TheCryptoDonkey)

**[Interactive Demo](https://forgesworn.github.io/geohash-kit/)** — try every API function on a live map.

## Why geohash-kit?

- **Modern TypeScript**: native types, ESM-only, tree-shakeable subpath exports. Zero dependencies. A modern alternative to `ngeohash` with a different API (names, return shapes and defaults differ; see [Migrating from ngeohash](#migrating-from-ngeohash)).
- **Smart polygon coverage** — adaptive multi-precision subdivision produces compact geohash sets (coarse interior, fine edges). Other polygon libraries use single-precision brute-force, producing 10-100x more cells for the same area.
- **Production-hardened** — input validation on all public APIs, RangeError on invalid/infeasible parameters, 736 tests including fuzz and property-based suites.
- **Nostr-native** — generates multi-precision `g`-tag ladders for publishing and location-based `#g` filter arrays for REQ subscriptions. Perfect for building location-based Nostr applications.

## Install

```bash
npm install geohash-kit
```

The root entry point `geohash-kit` re-exports the whole API. The subpaths `geohash-kit/core`, `geohash-kit/coverage` and `geohash-kit/nostr` expose the same functions grouped by module, for smaller imports.

## Quick Start

```typescript
import {
  encode, decode, neighbours, distance,
  polygonToGeohashes, geohashesToGeoJSON,
  createGTagLadder, createGTagFilter,
} from 'geohash-kit'

// Encode a location
const hash = encode(51.5074, -0.1278)  // 'gcpvj'

// Decode back to coordinates
const { lat, lon, error } = decode(hash)  // error: { lat, lon }, half the cell's height and width in degrees

// Get adjacent cells
const adj = neighbours(hash)  // { n, ne, e, se, s, sw, w, nw }

// Distance between two geohashes
const d = distance('gcpvj', 'u09tu')  // ~340km (London → Paris)

// Cover a polygon with geohashes
// Note: polygon coordinates are [longitude, latitude] (GeoJSON standard)
// This is the opposite of encode(latitude, longitude)
// The ring may be open (as here) or closed (as in the donut below)
const coverage = polygonToGeohashes([
  [-0.15, 51.50], [-0.10, 51.50],
  [-0.10, 51.52], [-0.15, 51.52],
])

// Render coverage on a map
const geojson = geohashesToGeoJSON(coverage)

// Cover a donut polygon (outer ring with a hole)
const donut = polygonToGeohashes({
  type: 'Polygon',
  coordinates: [
    [[-0.15, 51.49], [-0.05, 51.49], [-0.05, 51.54], [-0.15, 51.54], [-0.15, 51.49]],
    [[-0.12, 51.51], [-0.08, 51.51], [-0.08, 51.53], [-0.12, 51.53], [-0.12, 51.51]],
  ],
})

// Generate Nostr event tags
const tags = createGTagLadder(hash)
// [['g','g'], ['g','gc'], ['g','gcp'], ['g','gcpv'], ['g','gcpvj']]

// Generate Nostr subscription filter
const filter = createGTagFilter(51.5074, -0.1278, 5000)
// { '#g': ['gcpvj', 'gcpvm', ...] }
```

## For Nostr Developers

Nostr relays match `#g` tags by exact equality — there's no prefix matching. An event tagged `["g", "gcpvjb"]` won't match filter `{"#g": ["gcpvj"]}`. The workaround is a **tag ladder**: publish every precision prefix, subscribe at the right precision with neighbour expansion.

**Building location-based Nostr apps?** Use geohash-kit to:
- Tag events with multi-precision `g`-tag ladders for geographic discoverability
- Query nearby events using ring-based expansion (`expandRings`)
- Filter subscriptions by location using geohash proximity matching

### Publishing

```typescript
import { encode } from 'geohash-kit/core'
import { createGTagLadder } from 'geohash-kit/nostr'

const hash = encode(51.5074, -0.1278, 6)
const tags = createGTagLadder(hash)
// Add to your event: [['g','g'], ['g','gc'], ..., ['g','gcpvjb']]
```

### Subscribing

```typescript
import { createGTagFilter, nearbyFilter } from 'geohash-kit/nostr'

// From coordinates + radius: precision is derived from the radius,
// and the filter is the matching cell plus one ring of neighbours (up to 9 hashes)
const filter = createGTagFilter(51.5074, -0.1278, 5000)
// { '#g': ['gcpvj', ...neighbours] }

// Or with explicit precision and ring count (defaults: precision 5, rings 1)
const filter2 = nearbyFilter(51.5074, -0.1278, { precision: 4, rings: 2 })
```

### Parsing events

```typescript
import { parseGTags, bestGeohash } from 'geohash-kit/nostr'

const best = bestGeohash(event.tags)  // highest-precision g tag
const all = parseGTags(event.tags)    // [{ geohash, precision }, ...]
```

## API Reference

All functions are available from the root `geohash-kit` entry point; the headings show which subpath groups them.

### `geohash-kit/core`

| Function | Returns | Description |
|----------|---------|-------------|
| `encode(lat, lon, precision?)` | `string` | Encode coordinates to a geohash. `precision` defaults to 5 (~4.9 km), is rounded to an integer and capped at 12; throws `RangeError` if it rounds to less than 1 |
| `decode(hash)` | `{ lat, lon, error }` | Cell centre. `error` is `{ lat: number, lon: number }` in degrees: half the cell's height and width, so the cell spans `lat ± error.lat` and `lon ± error.lon` |
| `bounds(hash)` | `GeohashBounds` | Bounding rectangle `{ minLat, maxLat, minLon, maxLon }` |
| `children(hash)` | `string[]` | 32 child geohashes at next precision |
| `neighbour(hash, direction)` | `string` | Single adjacent cell at the same precision. `direction` is a `Direction` (see below) |
| `neighbours(hash)` | `Record<Direction, string>` | All 8 adjacent cells, keyed by direction |
| `contains(a, b)` | `boolean` | Bidirectional prefix containment |
| `matchesAny(hash, candidates)` | `boolean` | Match against multi-precision set |
| `distance(hashA, hashB)` | `number` | Haversine distance in metres between cell centres |
| `distanceFromCoords(lat1, lon1, lat2, lon2)` | `number` | Haversine distance in metres |
| `midpoint(hashA, hashB)` | `{ lat, lon }` | Geographic midpoint between the centres of two cells |
| `midpointFromCoords(lat1, lon1, lat2, lon2)` | `{ lat, lon }` | Geographic midpoint between two coordinate pairs |
| `midpointFromCoordsMulti(points)` | `{ lat, lon }` | Spherical vector mean of N points. `points` is a non-empty `ReadonlyArray<{ lat: number; lon: number }>`; throws `RangeError` if empty |
| `radiusToPrecision(metres)` | `number` | Precision 1 to 9: the coarsest whose approximate cell radius is no larger than `metres` (9 if `metres` is smaller than all of them) |
| `precisionToRadius(precision)` | `number` | Approximate cell radius in metres; `precision` is rounded and clamped to 1 to 9 |

**`Direction`:** `'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'`

### `geohash-kit/coverage`

| Function | Returns | Description |
|----------|---------|-------------|
| `polygonToGeohashes(polygon, options?)` | `string[]` | Adaptive threshold polygon coverage, sorted. `polygon` is a `PolygonInput`; see [Polygon input](#polygon-input) |
| `geohashesToGeoJSON(hashes)` | `GeohashGeoJSON` | GeoJSON `FeatureCollection` for map rendering: one rectangular `Polygon` feature per hash, with `properties: { geohash, precision }` |
| `geohashesToConvexHull(hashes)` | `[number, number][]` | Convex hull of all cell corners as `[lon, lat]` vertices, counter-clockwise. Empty input gives `[]`; throws if the hashes straddle ±180° longitude |
| `convexHull(points)` | `[number, number][]` | Convex hull of `[x, y]` points (Andrew's monotone chain), counter-clockwise; duplicates removed |
| `deduplicateGeohashes(hashes, options?)` | `string[]` | Remove redundant ancestors, sorted; `{ lossy: true }` merges ≥30/32 siblings |
| `pointInPolygon(point, polygon)` | `boolean` | Ray-casting point-in-polygon test. `point` is `[lon, lat]` and `polygon` is `[lon, lat][]` (a plain array, not GeoJSON); the ring closes automatically |
| `boundsOverlapsPolygon(bounds, polygon)` | `boolean` | Bounds–polygon overlap test. `bounds` is a `GeohashBounds`, `polygon` is `[lon, lat][]` |
| `boundsFullyInsidePolygon(bounds, polygon)` | `boolean` | Bounds fully inside polygon test. `bounds` is a `GeohashBounds`, `polygon` is `[lon, lat][]` |

**`CoverageOptions`** (all fields optional; non-finite values and `maxCells < 1` throw `RangeError`):

| Field | Default | Meaning |
|-------|---------|---------|
| `minPrecision` | 1 | Coarsest precision used when subdividing. Rounded and clamped to 1 to 9 |
| `maxPrecision` | 9 | Finest precision, used along polygon edges. Rounded, clamped to 1 to 9 and never below `minPrecision` |
| `maxCells` | 500 | Limit on the result size. If exceeded, `maxPrecision` is stepped down until the result fits; throws `RangeError` if even `minPrecision` does not fit |
| `mergeThreshold` | 1.0 | Clamped to 0 to 1. At 1.0 interior cells are emitted at `maxPrecision` and only complete 32-sibling sets merge; at 0.0 interior cells are as coarse as `minPrecision` and sets of 24 or more merge |

**`PolygonInput`:** `[number, number][] | GeoJSONPolygon | GeoJSONMultiPolygon`

#### Polygon input

- Vertices are `[longitude, latitude]` (GeoJSON order), the opposite of `encode(lat, lon)`.
- Rings may be open or closed. The last vertex is joined to the first automatically, so `[A, B, C]` and `[A, B, C, A]` give the same result. For GeoJSON rings a repeated closing vertex is dropped before processing. A ring needs at least three vertices, not counting a closing repeat.
- For a GeoJSON `Polygon`, the first ring is the outer boundary and any further rings are holes. A `MultiPolygon` is a list of `Polygon` coordinate arrays.

### `geohash-kit/nostr`

| Function | Returns | Description |
|----------|---------|-------------|
| `createGTagLadder(geohash, minPrecision?)` | `string[][]` | One `['g', prefix]` tag per precision from `minPrecision` (default 1) up to the length of `geohash`. Empty if `minPrecision` exceeds that length |
| `createGTagFilter(lat, lon, radiusMetres)` | `{ '#g': string[] }` | REQ filter from coordinates. Precision is `radiusToPrecision(radiusMetres)` and the ring count is fixed at 1, so the filter holds the cell containing the point plus its neighbours (up to 9 hashes). This approximates the radius and does not guarantee to cover all of it; use `nearbyFilter` for wider coverage |
| `createGTagFilterFromGeohashes(hashes)` | `{ '#g': string[] }` | REQ filter from hash set (validated and de-duplicated) |
| `expandRings(hash, rings?)` | `string[][]` | Concentric neighbour rings: index 0 is `[hash]` and index `n` is ring `n`. `rings` defaults to 1, is rounded and capped at 10; `0` gives `[[hash]]`; negative or non-finite throws `RangeError` |
| `nearbyFilter(lat, lon, options?)` | `{ '#g': string[] }` | Encode + expand + filter. `options` is `{ precision?, rings? }` with defaults `precision` 5 and `rings` 1 (up to 9 hashes) |
| `parseGTags(tags)` | `{ geohash: string; precision: number }[]` | Extract g tags from event; invalid geohashes are dropped |
| `bestGeohash(tags)` | `string`, or `undefined` if none | Highest-precision g tag |

## Polygon Coverage Algorithm

`polygonToGeohashes` uses adaptive threshold recursive subdivision:

1. BFS from precision-1 cells that overlap the polygon
2. For each cell: fully inside → emit (if deep enough); at max precision → emit if overlaps; partial → subdivide children
3. `mergeThreshold` controls interior cell granularity: 1.0 = uniform max precision, 0.0 = coarsest fully-inside cells
4. If result exceeds `maxCells`, `maxPrecision` is stepped down until the result fits
5. Post-processing merges sibling sets based on `mergeThreshold` — at threshold 1.0 only complete sets (32/32), at 0.0 as few as 24/32. Result is sorted and deduplicated
6. If no precision level fits within `maxCells`, a `RangeError` is thrown — increase `maxCells` or reduce the polygon area
7. **Holes:** GeoJSON Polygon inner rings (holes) are respected — cells fully inside a hole are excluded, cells overlapping a hole boundary subdivide to `maxPrecision` for accuracy. Degenerate holes (< 3 vertices) are silently ignored
8. **MultiPolygon:** `maxCells` is enforced globally across all child polygons, not per-polygon. The algorithm steps down precision until the merged result fits the budget

**Memory:** `polygonToGeohashes` builds the full result array in memory. At `maxCells: 100,000` with average hash length 6, this is roughly 1–2 MB — well within typical Node.js/browser limits. For extremely large polygons (millions of cells), consider splitting the polygon into smaller regions and processing each independently.

## Comparison

| Feature | geohash-kit | ngeohash | geohashing | latlon-geohash | geohash-poly | shape2geohash | nostr-geotags |
|---------|:-----------:|:--------:|:----------:|:--------------:|:------------:|:-------------:|:-------------:|
| TypeScript native | **Yes** | No | Yes | No | No | No | Yes |
| ESM-only | **Yes** | No | No | Yes | No | No | Yes |
| Zero dependencies | **Yes** | Yes | Yes | Yes | No (10) | No (11) | No (2) |
| Polygon → geohashes | **Multi-precision** | — | — | — | Single-precision | Single-precision | — |
| Multi-precision output | **Yes** | — | — | — | No | No | — |
| maxCells budget | **Yes** | — | — | — | No | No | — |
| GeoJSON output | **Yes** | No | Yes | No | No | No | No |
| Convex hull | **Yes** | No | No | No | No | No | No |
| Deduplication | **Yes** | No | No | No | No | No | No |
| Distance / radius | **Yes** | No | No | No | No | No | No |
| Neighbours / rings | **Yes** | Yes | Yes | Yes | No | No | No |
| Nostr g-tag ladders | **Yes** | No | No | No | No | No | Partial |
| Nostr REQ filters | **Yes** | No | No | No | No | No | No |
| Input validation | **Yes** | No | No | No | No | No | No |
| Last published | 2026 | 2018 | 2024 | 2019 | 2019 | 2022 | 2025 |
| Weekly downloads | — | ~171k | ~7k | ~19k | ~1k | ~500 | <100 |

## Migrating from ngeohash

geohash-kit is a modern TypeScript alternative to [ngeohash](https://github.com/sunng87/node-geohash). It is not a drop-in replacement: names, return shapes and defaults differ, as listed below.

**Import change:**

```typescript
// Before
const ngeohash = require('ngeohash')

// After (ESM)
import { encode, decode, bounds, neighbours } from 'geohash-kit'
```

**Function mapping:**

| ngeohash | geohash-kit | Notes |
|----------|-------------|-------|
| `encode(lat, lon, precision?)` | `encode(lat, lon, precision?)` | Same argument order, but the default precision differs: ngeohash 9, geohash-kit 5. Pass `9` explicitly to keep ngeohash's output length |
| `decode(hash)` | `decode(hash)` | Returns `{ lat, lon, error: { lat, lon } }` instead of `{ latitude, longitude, error: { latitude, longitude } }` |
| `decode_bbox(hash)` | `bounds(hash)` | Returns `{ minLat, maxLat, minLon, maxLon }` object instead of `[minlat, minlon, maxlat, maxlon]` array |
| `neighbors(hash)` | `neighbours(hash)` | British spelling; returns `{ n, ne, e, ... }` object instead of array |
| `neighbor(hash, [latDir, lonDir])` | `neighbour(hash, direction)` | Direction is a string (`'n'`, `'sw'`, etc.) instead of `[1, 0]` array |
| `bboxes(minLat, minLon, maxLat, maxLon, precision)` | `polygonToGeohashes(polygon, options)` | No direct equivalent: cover the rectangle as a polygon at one fixed precision (example below). Also accepts polygons, multi-precision output and a `maxCells` budget |
| `encode_int` / `decode_int` / `*_int` | none | Integer geohash encoding not supported |

**Replacing `bboxes`:** `bboxes` returns every cell at one precision that covers a rectangle. Pass the rectangle as a `[lon, lat]` polygon and pin `minPrecision` and `maxPrecision` to the same value:

```typescript
import { polygonToGeohashes } from 'geohash-kit'

const minLat = 51.50, minLon = -0.15, maxLat = 51.52, maxLon = -0.10
const precision = 6

// ngeohash: bboxes(minLat, minLon, maxLat, maxLon, precision)
const cells = polygonToGeohashes(
  [[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat]],
  { minPrecision: precision, maxPrecision: precision, maxCells: 100_000 },
)
// every cell is `precision` characters long; the result is sorted
```

Raise `maxCells` to suit the rectangle: the default of 500 throws `RangeError` when the result would be larger (this rectangle needs 570 cells at precision 7). Rectangles crossing ±180° longitude are not supported. The order of the result differs from `bboxes`, and cells on an exact rectangle edge may be included or excluded differently (see the boundary note below).

**Key differences:**

- **ESM-only**: no `require()`, use `import` syntax
- **Input validation**: throws `RangeError` on invalid coordinates, NaN, or Infinity (ngeohash returns garbage)
- **British English**: `neighbours` not `neighbors`, `neighbour` not `neighbor`
- **Structured returns**: named object properties instead of positional arrays
- **Precision handling**: `precision` is rounded to an integer, capped at 12 and must be at least 1. ngeohash's `'auto'` precision and string coordinates are rejected with `RangeError`
- **Cell boundaries**: a coordinate exactly on a cell boundary goes to the upper cell in geohash-kit and the lower cell in ngeohash, so `encode(0, 0, 5)` is `'s0000'` here and `'7zzzz'` in ngeohash

## Benchmarking

geohash-kit includes comprehensive performance benchmarks for all major functions. Run them with:

```bash
npm run bench
```

Performance summary:
- **Core functions** (encode, decode, bounds, etc.): >5M ops/sec, all sub-100µs
- **`polygonToGeohashes`** (the main workhorse): 282–7,230 ops/sec depending on polygon size and precision
- **Nostr functions** (tag ladders, filters): 256k–10M ops/sec

For detailed performance analysis, device comparisons, and optimization guidance, see [docs/BENCHMARKS.md](https://github.com/forgesworn/geohash-kit/blob/main/docs/BENCHMARKS.md).

## Runtime Compatibility

geohash-kit is pure ESM with zero dependencies and no Node.js-specific APIs. It works in:

- **Node.js** 18+ (supported, tested in CI)
- **Deno** — import from npm: `import { encode } from 'npm:geohash-kit'`
- **Bun** — works out of the box: `import { encode } from 'geohash-kit'`
- **Browsers** — bundler-compatible (Vite, esbuild, Rollup, webpack 5)
- **Cloudflare Workers** — ESM-compatible, no filesystem or network calls

## Android Compatibility

For Kotlin/Android parity implementations, use the compatibility contract and versioned vectors:

- [docs/android-compat.md](https://github.com/forgesworn/geohash-kit/blob/main/docs/android-compat.md)
- [vectors/schema.json](https://github.com/forgesworn/geohash-kit/blob/main/vectors/schema.json)
- `npm run vectors:check` (run after `npm run build`)

## For AI Assistants

See [llms.txt](./llms.txt) for a concise API summary, or [llms-full.txt](./llms-full.txt) for the complete reference with examples.

## Part of the ForgeSworn Toolkit

[ForgeSworn](https://forgesworn.dev) builds open-source cryptographic identity, payments, and coordination tools for Nostr.

| Library | What it does |
|---------|-------------|
| [nsec-tree](https://github.com/forgesworn/nsec-tree) | Deterministic sub-identity derivation |
| [ring-sig](https://github.com/forgesworn/ring-sig) | SAG/LSAG ring signatures on secp256k1 |
| [range-proof](https://github.com/forgesworn/range-proof) | Pedersen commitment range proofs |
| [canary-kit](https://github.com/forgesworn/canary-kit) | Coercion-resistant spoken verification |
| [spoken-token](https://github.com/forgesworn/spoken-token) | Human-speakable verification tokens |
| [toll-booth](https://github.com/forgesworn/toll-booth) | L402 payment middleware |
| [geohash-kit](https://github.com/forgesworn/geohash-kit) | Geohash toolkit with polygon coverage |
| [nostr-attestations](https://github.com/forgesworn/nostr-attestations) | NIP-VA verifiable attestations |
| [dominion](https://github.com/forgesworn/dominion) | Epoch-based encrypted access control |
| [rendezvous-kit](https://github.com/forgesworn/rendezvous-kit) | Fair meeting point discovery using isochrones |
| [nostr-veil](https://github.com/forgesworn/nostr-veil) | Privacy-preserving Web of Trust |

## Licence

[MIT](https://github.com/forgesworn/geohash-kit/blob/main/LICENSE)

## Support

For issues and feature requests, see [GitHub Issues](https://github.com/forgesworn/geohash-kit/issues).

If you find geohash-kit useful, consider sending a tip:

- **Lightning:** `profusemeat89@walletofsatoshi.com`
- **Nostr zaps:** `npub1mgvlrnf5hm9yf0n5mf9nqmvarhvxkc6remu5ec3vf8r0txqkuk7su0e7q2`
