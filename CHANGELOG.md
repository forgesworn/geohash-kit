# [1.6.0](https://github.com/forgesworn/geohash-kit/compare/v1.5.3...v1.6.0) (2026-04-11)


### Changed

* migrate release tooling from `semantic-release` to [`forgesworn/release-action`](https://github.com/forgesworn/release-action). Removes hundreds of transitive devDependencies, hardens the pre-publish path with gated secret scanning, exports-map verification, frozen-vector gating, and runtime-only `npm audit`, and replaces the workflow-env `NPM_CONFIG_PROVENANCE=true` pattern (fragile on npm 11.6+) with `publishConfig.provenance: true` in `package.json`. No runtime or API changes for consumers.


### Why

`semantic-release`'s bundled `npm` CLI brings chronic Dependabot noise that does not affect published artefacts, and its transitive devDependency graph is large enough to conflict with the supply-chain posture a cryptography-adjacent library should hold itself to. The replacement is a pure-bash release tool with hard pre-publish gates. The existing frozen-vector check (`npm run vectors:check`) is now a release-blocking gate rather than a CI-only check — a drift in encoded output will refuse the publish until either the vectors or the implementation are explicitly updated.

`geohash-kit` is the second consumer of `forgesworn/release-action` after `nsec-tree@1.5.0`. This migration validates that the pattern generalises beyond a single library.

## [1.5.3](https://github.com/forgesworn/geohash-kit/compare/v1.5.2...v1.5.3) (2026-03-20)


### Bug Fixes

* correct copyright to TheCryptoDonkey ([8c18561](https://github.com/forgesworn/geohash-kit/commit/8c18561bd2d038f18b34fdeb024cc86e2262b294))

## [1.5.2](https://github.com/forgesworn/geohash-kit/compare/v1.5.1...v1.5.2) (2026-03-18)


### Bug Fixes

* repair broken tags and update CHANGELOG URLs after org transfer ([aeab662](https://github.com/forgesworn/geohash-kit/commit/aeab662ab105d11814b96b319f90a9c0d2a45e45))

## [1.5.1](https://github.com/forgesworn/geohash-kit/compare/v1.5.0...v1.5.1) (2026-03-12)


### Bug Fixes

* harden against prototype pollution, add input validation, cap ring expansion ([5297db9](https://github.com/forgesworn/geohash-kit/commit/5297db98154935e301957c6a3606b25b43444046))
* validate geohash input in createGTagFilterFromGeohashes ([844329a](https://github.com/forgesworn/geohash-kit/commit/844329a06313b2171b349a749a84a11659e9b7cb))

# [1.5.0](https://github.com/forgesworn/geohash-kit/compare/v1.4.2...v1.5.0) (2026-03-09)


### Features

* add android compatibility vectors and CI check ([fe6a015](https://github.com/forgesworn/geohash-kit/commit/fe6a0153f9ad54f8206631f08f3e72136355c8bb))

## [1.4.2](https://github.com/forgesworn/geohash-kit/compare/v1.4.1...v1.4.2) (2026-03-06)


### Bug Fixes

* deduplicate BASE32, tighten tests, update AI discoverability ([d21366b](https://github.com/forgesworn/geohash-kit/commit/d21366ba2f3f35d0f32654b7d000e1dcba61fae9))

## [1.4.1](https://github.com/forgesworn/geohash-kit/compare/v1.4.0...v1.4.1) (2026-03-05)


### Bug Fixes

* normalise repository URL in package.json ([a1ebe66](https://github.com/forgesworn/geohash-kit/commit/a1ebe6660f617149c6cd0d84927d9a66fd2d1215))

# [1.4.0](https://github.com/forgesworn/geohash-kit/compare/v1.3.0...v1.4.0) (2026-03-05)


### Features

* extract convexHull(points) coordinate-based primitive ([96b4179](https://github.com/forgesworn/geohash-kit/commit/96b4179cbdb99bc67785e3980cadf870fe49af81))

# [1.3.0](https://github.com/forgesworn/geohash-kit/compare/v1.2.0...v1.3.0) (2026-02-27)


### Features

* add circleToPolygon and getDestinationPoint for geodesic circle approximation ([952fe79](https://github.com/forgesworn/geohash-kit/commit/952fe79f29dd2ce4dcc8a79ad3bf2554c718a887))

# [1.2.0](https://github.com/forgesworn/geohash-kit/compare/v1.1.0...v1.2.0) (2026-02-27)


### Features

* add midpoint, midpointFromCoords, midpointFromCoordsMulti ([e8660da](https://github.com/forgesworn/geohash-kit/commit/e8660da9a8d1500bee330a39a25be0eb87668e75))
