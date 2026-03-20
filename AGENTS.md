# AGENTS.md — geohash-kit

Instructions in this file apply to the entire repository.

## Project Summary
- Zero-dependency TypeScript geohash toolkit.
- ESM-only package (`"type": "module"`).
- Requires Node.js 18+.

## Key Commands
- `npm run build` — compile TypeScript into `dist/`
- `npm test` — run the Vitest suite
- `npm run test:watch` — run tests in watch mode
- `npm run typecheck` — TypeScript type-check without emitting
- `npm run vectors:check` — validate vector fixtures

## Repository Structure
- `src/core.ts` — encode, decode, bounds, neighbours, distance
- `src/coverage.ts` — polygon coverage, GeoJSON, convex hull
- `src/nostr.ts` — Nostr g-tag ladders, REQ filters, ring expansion
- `src/index.ts` — barrel re-export
- `scripts/` — maintenance and validation scripts
- `vectors/` — test/vector data
- `dist/` — build output (generated)

## Coding Conventions
- Use British English spelling in identifiers and prose: `neighbour`, `colour`, `metre`, `licence`.
- Preserve the zero-runtime-dependency approach unless the user explicitly asks otherwise.
- Keep changes minimal and consistent with the existing module layout.
- Prefer TDD when changing behaviour: add or update a failing test first, then implement.
- Maintain ESM-compatible imports/exports.

## Working Guidelines
- Do not edit generated output in `dist/` by hand unless the user explicitly asks for it.
- Prefer targeted tests for the area being changed before broader validation.
- Update documentation when public API or behaviour changes.
- Keep release automation files compatible with `semantic-release`.

## Release Notes
- Conventional commit prefixes matter for releases: `fix:` for patch, `feat:` for minor, and `BREAKING CHANGE:` for major.
- Tests should pass before release-related changes are considered complete.
