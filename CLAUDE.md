# CLAUDE.md — geohash-kit

Zero-dependency TypeScript geohash toolkit.

## Commands

- `npm run build` — compile TypeScript to dist/
- `npm test` — run all tests (vitest)
- `npm run test:watch` — watch mode
- `npm run typecheck` — type-check without emitting

## Structure

- `src/core.ts` — encode, decode, bounds, neighbours, distance
- `src/coverage.ts` — polygon coverage, GeoJSON, convex hull
- `src/nostr.ts` — Nostr g-tag ladders, REQ filters, ring expansion
- `src/index.ts` — barrel re-export

## Subpath exports

- `geohash-kit` -- full API
- `geohash-kit/core` -- encode, decode, bounds, neighbours, distance
- `geohash-kit/coverage` -- polygon coverage, GeoJSON, convex hull
- `geohash-kit/nostr` -- Nostr g-tag ladders, REQ filters, ring expansion

## Conventions

- **British English** — neighbour, colour, metre, licence
- **Zero dependencies** — no runtime deps, only vitest + typescript as dev deps
- **ESM-only** — `"type": "module"` in package.json
- **TDD** — write failing test first, then implement
- **Git:** commit messages use `type: description` format
- **Git:** Do NOT include `Co-Authored-By` lines in commits

## Release & Versioning

**Via [forgesworn/release-action](https://github.com/forgesworn/release-action).** Version bumps are manual; npm publishing is automatic once a GitHub Release is created for the version tag.

Release flow:

1. Bump `package.json` version by hand (e.g. `1.5.3` → `1.6.0`)
2. Add a `CHANGELOG.md` entry under the new version heading
3. Commit (`chore: release 1.6.0`), push main
4. Tag the commit (`git tag v1.6.0 && git push --tags`)
5. Create a GitHub Release pointing at the tag (placeholder body is fine — the workflow replaces it from CHANGELOG)
6. The release workflow runs pre-publish gates (tag match, secret scan, exports sanity, frozen vectors, runtime audit) and publishes to npm with SLSA provenance via OIDC trusted publishing

Semver rules of thumb:

| Change | Bump |
|---|---|
| Bug fix, no API change | Patch (1.6.x) |
| New feature, backwards compatible | Minor (1.x.0) |
| Breaking API change | Major (x.0.0) |
| Tooling, docs, refactor with no behaviour change | Patch or none |

The frozen-vector gate (`npm run vectors:check`) is now a hard pre-publish blocker instead of a CI-only check. A drift in encoded output will refuse the publish until either the vectors or the implementation are explicitly updated.
