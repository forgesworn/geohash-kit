# GEMINI.md -- geohash-kit

Zero-dependency TypeScript geohash toolkit -- encode, decode, polygon coverage, and Nostr proximity filters.

## Commands

- `npm run build` -- compile TypeScript to dist/
- `npm test` -- run the Vitest suite
- `npm run typecheck` -- type-check without emitting
- `npm run vectors:check` -- validate vector fixtures
- `npm run test:watch` -- watch mode

## Structure

- `src/core.ts` -- encode, decode, bounds, neighbours, distance, midpoint, precision helpers
- `src/coverage.ts` -- polygon coverage, GeoJSON output, convex hull
- `src/nostr.ts` -- Nostr g-tag ladders, REQ filters, ring expansion
- `src/index.ts` -- barrel re-export
- `scripts/` -- maintenance and validation scripts
- `vectors/` -- test vector fixtures
- `dist/` -- build output (do not edit by hand)

## Subpath exports

- `geohash-kit` -- full API
- `geohash-kit/core` -- encode, decode, bounds, neighbours, distance
- `geohash-kit/coverage` -- polygon coverage, GeoJSON, convex hull
- `geohash-kit/nostr` -- Nostr g-tag ladders, REQ filters, ring expansion

## Conventions

- **British English** -- neighbour, colour, metre, licence (in identifiers and prose)
- **Zero runtime dependencies** -- do not add deps without explicit approval
- **ESM-only** -- `"type": "module"` in package.json; all imports use `.js` extensions
- **TDD** -- add a failing test before implementing behaviour changes
- **Commits** -- conventional format: `type: description` (fix/feat/docs/refactor/chore)
- **No `Co-Authored-By`** lines in commits

## Key Patterns and Gotchas

**Coordinate order varies by context -- this is the most common source of bugs:**

- `encode(lat, lon, precision)` -- latitude first, longitude second
- `decode(hash)` -- returns `{ lat, lon, error }`, not an array
- `bounds(hash)` -- returns `{ minLat, maxLat, minLon, maxLon }`, named fields
- `pointInPolygon(point, polygon)` -- takes `[x, y]` = `[lon, lat]` pairs (GeoJSON order)
- `PolygonInput` -- accepts `[lon, lat][]` or a GeoJSON Polygon/MultiPolygon
- GeoJSON polygon vertices are always `[lon, lat]` per the GeoJSON spec -- opposite to `encode`

**Other gotchas:**

- Precision defaults to 5 (~4.9 km); valid range is 1--9 for radius helpers, 1--12 for encode
- `neighbour` (British spelling) not `neighbor` -- applies to identifiers too
- `contains(a, b)` is bidirectional prefix containment, not strict parent/child
- `matchesAny` checks prefix overlap in either direction

## Testing

Tests live alongside source in `src/` or in dedicated test files. Run `npm test` for a single pass, `npm run test:watch` during development. Vector fixtures in `vectors/` are validated by `npm run vectors:check`.

Write a failing test before changing behaviour. Keep tests targeted to the area being changed.

## Release

Automated via semantic-release on push to `main`. Do not manually bump versions.

| Commit prefix | Version bump |
|---------------|-------------|
| `fix:` | Patch (1.0.x) |
| `feat:` | Minor (1.x.0) |
| `BREAKING CHANGE:` in body | Major (x.0.0) |
| `chore:`, `docs:`, `refactor:` | None |

Publishing uses OIDC trusted publishing -- no NPM token required.
