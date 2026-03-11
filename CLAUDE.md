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

## Conventions

- **British English** — neighbour, colour, metre, licence
- **Zero dependencies** — no runtime deps, only vitest + typescript as dev deps
- **ESM-only** — `"type": "module"` in package.json
- **TDD** — write failing test first, then implement
- **Git:** commit messages use `type: description` format
- **Git:** Do NOT include `Co-Authored-By` lines in commits

## Release & Versioning

**Automated via semantic-release** — version bumps and npm publishing happen automatically when you push to `main`.

| Type | Example | Version Bump |
|------|---------|--------------|
| `fix:` | `fix: handle edge case in decode` | Patch (1.0.x) |
| `feat:` | `feat: add new API function` | Minor (1.x.0) |
| `BREAKING CHANGE:` | In commit body | Major (x.0.0) |
| `chore:`, `docs:`, `refactor:` | `docs: update README` | None |

Tests must pass before release. GitHub Actions uses OIDC trusted publishing.
