# geohash-kit

**The modern TypeScript geohash toolkit — encode, decode, cover polygons, and build Nostr filters.**

[![npm](https://img.shields.io/npm/v/geohash-kit)](https://www.npmjs.com/package/geohash-kit)
[![licence](https://img.shields.io/npm/l/geohash-kit)](./LICENCE)
![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-native-blue)

## Why geohash-kit?

- **Modern TypeScript** — native types, ESM-only, tree-shakeable subpath exports. Zero dependencies. A drop-in replacement for `ngeohash`.
- **Smart polygon coverage** — adaptive multi-precision subdivision produces compact geohash sets (coarse interior, fine edges). Other polygon libraries use single-precision brute-force, producing 10-100x more cells for the same area.
- **Production-hardened** — input validation on all public APIs, RangeError on invalid/infeasible parameters, 736 tests including fuzz and property-based suites.
- **Nostr-native** — the only library that generates correct multi-precision `g`-tag ladders for publishing and `#g` filter arrays for REQ subscriptions.

## Install

```bash
npm install geohash-kit
```

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
const { lat, lon, error } = decode(hash)

// Get adjacent cells
const adj = neighbours(hash)  // { n, ne, e, se, s, sw, w, nw }

// Distance between two geohashes
const d = distance('gcpvj', 'u09tu')  // ~340km (London → Paris)

// Cover a polygon with geohashes
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

// From coordinates + radius
const filter = createGTagFilter(51.5074, -0.1278, 5000)
// { '#g': ['gcpvj', ...neighbours] }

// Or with explicit precision and ring count
const filter2 = nearbyFilter(51.5074, -0.1278, { precision: 4, rings: 2 })
```

### Parsing events

```typescript
import { parseGTags, bestGeohash } from 'geohash-kit/nostr'

const best = bestGeohash(event.tags)  // highest-precision g tag
const all = parseGTags(event.tags)    // [{ geohash, precision }, ...]
```

## API Reference

### `geohash-kit/core`

| Function | Description |
|----------|-------------|
| `encode(lat, lon, precision?)` | Encode coordinates to geohash (default precision 5) |
| `decode(hash)` | Decode to `{ lat, lon, error }` |
| `bounds(hash)` | Bounding rectangle `{ minLat, maxLat, minLon, maxLon }` |
| `children(hash)` | 32 child geohashes at next precision |
| `neighbour(hash, direction)` | Single adjacent cell |
| `neighbours(hash)` | All 8 adjacent cells |
| `contains(a, b)` | Bidirectional prefix containment |
| `matchesAny(hash, candidates)` | Match against multi-precision set |
| `distance(hashA, hashB)` | Haversine distance in metres |
| `distanceFromCoords(lat1, lon1, lat2, lon2)` | Haversine distance in metres |
| `radiusToPrecision(metres)` | Optimal precision for search radius |
| `precisionToRadius(precision)` | Approximate cell radius in metres |

### `geohash-kit/coverage`

| Function | Description |
|----------|-------------|
| `polygonToGeohashes(polygon, options?)` | Adaptive threshold polygon coverage; accepts `[lon, lat][]`, GeoJSON `Polygon` (with holes), or `MultiPolygon` |
| `geohashesToGeoJSON(hashes)` | GeoJSON FeatureCollection for map rendering |
| `geohashesToConvexHull(hashes)` | Convex hull reconstruction |
| `deduplicateGeohashes(hashes, options?)` | Remove redundant ancestors; `{ lossy: true }` merges ≥30/32 siblings |
| `pointInPolygon(point, polygon)` | Ray-casting point-in-polygon test |
| `boundsOverlapsPolygon(bounds, polygon)` | Bounds–polygon overlap test |
| `boundsFullyInsidePolygon(bounds, polygon)` | Bounds fully inside polygon test |

**`CoverageOptions`:** `{ minPrecision?, maxPrecision?, maxCells?, mergeThreshold? }`

**`PolygonInput`:** `[number, number][] | GeoJSONPolygon | GeoJSONMultiPolygon`

### `geohash-kit/nostr`

| Function | Description |
|----------|-------------|
| `createGTagLadder(geohash, minPrecision?)` | Multi-precision g-tag ladder |
| `createGTagFilter(lat, lon, radiusMetres)` | REQ filter from coordinates |
| `createGTagFilterFromGeohashes(hashes)` | REQ filter from hash set |
| `expandRings(hash, rings?)` | Concentric neighbour rings |
| `nearbyFilter(lat, lon, options?)` | Encode + expand + filter |
| `parseGTags(tags)` | Extract g tags from event |
| `bestGeohash(tags)` | Highest-precision g tag |

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

geohash-kit is a modern TypeScript replacement for [ngeohash](https://github.com/sunng87/node-geohash).

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
| `encode(lat, lon, precision?)` | `encode(lat, lon, precision?)` | Same signature |
| `decode(hash)` | `decode(hash)` | Returns `{ lat, lon, error }` instead of `{ latitude, longitude, error }` |
| `decode_bbox(hash)` | `bounds(hash)` | Returns `{ minLat, maxLat, minLon, maxLon }` object instead of `[minlat, minlon, maxlat, maxlon]` array |
| `neighbors(hash)` | `neighbours(hash)` | British spelling; returns `{ n, ne, e, ... }` object instead of array |
| `neighbor(hash, [latDir, lonDir])` | `neighbour(hash, direction)` | Direction is a string (`'n'`, `'sw'`, etc.) instead of `[1, 0]` array |
| `bboxes(minLat, minLon, maxLat, maxLon, precision)` | `polygonToGeohashes(polygon)` | More powerful: accepts polygons (not just rectangles), multi-precision output, maxCells budget |
| `encode_int` / `decode_int` / `*_int` | — | Integer geohash encoding not supported |

**Key differences:**

- **ESM-only** — no `require()`, use `import` syntax
- **Input validation** — throws `RangeError` on invalid coordinates, NaN, or Infinity (ngeohash returns garbage)
- **British English** — `neighbours` not `neighbors`, `neighbour` not `neighbor`
- **Structured returns** — named object properties instead of positional arrays

## For AI Assistants

See [llms.txt](./llms.txt) for a concise API summary, or [llms-full.txt](./llms-full.txt) for the complete reference with examples.

## Licence

[MIT](./LICENCE)
