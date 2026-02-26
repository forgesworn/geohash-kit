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

### Commit Message Types (triggers auto-versioning)

Use conventional commits. The `type:` prefix determines the version bump:

| Type | Example | Version Bump | npm Published |
|------|---------|--------------|---------------|
| `fix:` | `fix: handle edge case in decode` | Patch (1.0.0 → 1.0.1) | ✅ Yes |
| `feat:` | `feat: add new API function` | Minor (1.0.0 → 1.1.0) | ✅ Yes |
| `BREAKING CHANGE:` | In commit body: `BREAKING CHANGE: removed X function` | Major (1.0.0 → 2.0.0) | ✅ Yes |
| `chore:`, `docs:`, `refactor:` | `docs: update README` | None (no release) | ❌ No |

### Release Workflow

```bash
# 1. Make changes and commit with conventional message
git commit -m "feat: add new coverage function"

# 2. Push to main
git push origin main

# 3. CI automatically:
#    - Runs tests (must pass)
#    - Detects version bump from commit message
#    - Updates package.json version
#    - Publishes to npm (via Trusted Publishing/OIDC)
#    - Creates GitHub release with changelog
#    - Tags commit with version number
```

### Important Notes

- Tests must pass before release — if any test fails, release is skipped
- Semantic-release creates version commits and tags automatically
- No manual version management needed — never edit version numbers
- GitHub Actions uses Trusted Publishing (OIDC) — no npm tokens required
