# geohash-kit

Instructions in this file apply to the entire repository.

## Project Summary

Zero-dependency TypeScript geohash toolkit: encode, decode, polygon coverage,
and Nostr g-tag proximity filters. ESM-only (`"type": "module"`), requires
Node.js 18+.

## Commands

- `npm install`: install dependencies.
- `npm run build`: compile TypeScript to `dist/`.
- `npm test`: run the Vitest suite.
- `npm run test:watch`: watch mode.
- `npm run typecheck`: type-check without emitting.
- `npm run bench`: run performance benchmarks.
- `npm run vectors:check`: validate vector fixtures against frozen encodings.

## Repository Structure

- `src/core.ts`: encode, decode, bounds, neighbours, distance, midpoint, precision helpers.
- `src/coverage.ts`: polygon coverage, GeoJSON output, convex hull.
- `src/nostr.ts`: Nostr g-tag ladders, REQ filters, ring expansion.
- `src/index.ts`: barrel re-export.
- `scripts/`: maintenance and validation scripts.
- `vectors/`: frozen test vector fixtures.
- `dist/`: build output (generated; do not edit by hand).

## Subpath Exports

- `geohash-kit`: full API.
- `geohash-kit/core`: encode, decode, bounds, neighbours, distance.
- `geohash-kit/coverage`: polygon coverage, GeoJSON, convex hull.
- `geohash-kit/nostr`: Nostr g-tag ladders, REQ filters, ring expansion.

## Conventions

- British English in identifiers and prose: `neighbour`, `colour`, `metre`, `licence`.
- Zero runtime dependencies, only vitest and typescript as dev deps; do not add
  a runtime dependency without explicit approval.
- ESM-only imports/exports; all imports use `.js` extensions.
- TDD: add or update a failing test before implementing a behaviour change.
- All public APIs validate inputs and throw `RangeError` on invalid parameters.
- Commit messages: `type: description` (fix/feat/docs/refactor/chore). No
  `Co-Authored-By` lines.

## Key Patterns and Gotchas

Coordinate order varies by context; this is the most common source of bugs:

- `encode(lat, lon, precision)`: latitude first, longitude second.
- `decode(hash)`: returns `{ lat, lon, error }`, not an array.
- `bounds(hash)`: returns `{ minLat, maxLat, minLon, maxLon }`, named fields.
- `pointInPolygon(point, polygon)`: takes `[x, y]` = `[lon, lat]` pairs (GeoJSON order).
- `PolygonInput`: accepts `[lon, lat][]` or a GeoJSON Polygon/MultiPolygon.
- GeoJSON polygon vertices are always `[lon, lat]` per the GeoJSON spec, the
  opposite of `encode`.

Other gotchas:

- Precision defaults to 5 (~4.9 km); valid range is 1–9 for radius helpers,
  1–12 for `encode`.
- `neighbour` (British spelling), not `neighbor`; applies to identifiers too.
- `contains(a, b)` is bidirectional prefix containment, not strict parent/child.
- `matchesAny` checks prefix overlap in either direction.

## Working Guidelines

- Do not edit `dist/` by hand.
- Prefer targeted tests for the area being changed before running the full suite.
- Update documentation when public API or behaviour changes.
- The frozen-vector gate (`npm run vectors:check`) is a hard pre-publish
  blocker: a drift in encoded output refuses the publish until either the
  vectors or the implementation are explicitly updated.

## Release

Releases go via [forgesworn/anvil](https://github.com/forgesworn/anvil), not
an automatic push-triggered pipeline:

1. Bump `package.json` version by hand (e.g. `1.5.3` to `1.6.0`).
2. Add a `CHANGELOG.md` entry under the new version heading.
3. Commit (`chore: release 1.6.0`), push `main`.
4. Tag the commit (`git tag v1.6.0 && git push --tags`).
5. Create a GitHub Release pointing at the tag (placeholder body is fine; the
   workflow replaces it from `CHANGELOG.md`).
6. The `release` workflow (`.github/workflows/release.yml`, published only on
   the GitHub Release event) runs pre-publish gates: tag match, secret scan,
   exports sanity, frozen vectors, runtime audit, then publishes to npm with
   SLSA provenance via OIDC trusted publishing.

Semver rules of thumb:

| Change | Bump |
|---|---|
| Bug fix, no API change | Patch (1.6.x) |
| New feature, backwards compatible | Minor (1.x.0) |
| Breaking API change | Major (x.0.0) |
| Tooling, docs, refactor with no behaviour change | Patch or none |

## Testing

Tests live alongside source as `*.test.ts`; the suite includes unit, fuzz, and
property-based tests. Run `npm test` for a single pass, `npm run test:watch`
during development, `npx vitest run src/core.test.ts` for a single file.
Vector fixtures in `vectors/` are validated by `npm run vectors:check`.
