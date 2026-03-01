# Contributing to geohash-kit

## Setup

```bash
git clone https://github.com/TheCryptoDonkey/geohash-kit.git
cd geohash-kit
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Watch mode |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run typecheck` | Type-check without emitting |
| `npm run bench` | Run performance benchmarks |

## Project Structure

```
src/
  core.ts       — encode, decode, bounds, neighbours, distance
  coverage.ts   — polygon coverage, GeoJSON, convex hull, deduplication
  nostr.ts      — Nostr g-tag ladders, REQ filters, ring expansion
  index.ts      — barrel re-export
```

Three subpath exports mirror the source modules: `geohash-kit/core`, `geohash-kit/coverage`, `geohash-kit/nostr`.

## Conventions

- **British English** — neighbour, colour, metre, licence
- **Zero dependencies** — no runtime deps. Only vitest and typescript as dev deps.
- **ESM-only** — `"type": "module"` in package.json
- **TDD** — write a failing test first, then implement
- **Input validation** — all public APIs validate inputs and throw `RangeError` on invalid parameters

## Testing

Tests live alongside source files as `*.test.ts`. The suite includes unit tests, fuzz tests, and property-based tests (736 total).

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run src/core.test.ts

# Watch mode
npm run test:watch
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-change`
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Ensure types check: `npm run typecheck`
6. Commit with a conventional message (see below)
7. Open a pull request against `main`

## Commit Messages

This project uses [semantic-release](https://semantic-release.gitbook.io/) — commit message prefixes determine version bumps:

| Prefix | Version bump | Example |
|--------|-------------|---------|
| `feat:` | Minor (1.x.0) | `feat: add bounding box intersection` |
| `fix:` | Patch (1.0.x) | `fix: handle antimeridian wrap` |
| `docs:` | None | `docs: update API reference` |
| `chore:` | None | `chore: update dev dependencies` |
| `refactor:` | None | `refactor: simplify polygon walk` |
