// geohash-kit/coverage — polygon-to-geohash coverage, GeoJSON, convex hull

import { bounds as geohashBounds, children as geohashChildren } from './core.js'
import type { GeohashBounds } from './core.js'
import type { PolygonInput, GeoJSONPolygon, GeoJSONMultiPolygon } from './geojson.js'

// Re-export GeohashBounds for convenience
export type { GeohashBounds } from './core.js'
export type { PolygonInput, GeoJSONPolygon, GeoJSONMultiPolygon } from './geojson.js'

// --- Point-in-polygon (ray-casting) ---

/**
 * Ray-casting algorithm: test whether a point [x, y] lies inside a polygon.
 * Polygon is an array of [x, y] vertices (closed automatically).
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [px, py] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Test whether all four corners of bounds lie inside the polygon.
 */
export function boundsFullyInsidePolygon(
  bounds: GeohashBounds,
  polygon: [number, number][],
): boolean {
  const corners: [number, number][] = [
    [bounds.minLon, bounds.minLat],
    [bounds.maxLon, bounds.minLat],
    [bounds.maxLon, bounds.maxLat],
    [bounds.minLon, bounds.maxLat],
  ]
  if (!corners.every((c) => pointInPolygon(c, polygon))) return false

  // For concave polygons, all corners can be inside while the polygon edge
  // cuts through the cell. If any polygon edge intersects a cell edge, the
  // cell is not fully inside.
  const boundsEdges: [[number, number], [number, number]][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ]
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    for (const be of boundsEdges) {
      if (segmentsIntersect(be[0], be[1], polygon[j], polygon[i])) return false
    }
  }
  return true
}

/**
 * Test whether a bounds rectangle overlaps a polygon at all.
 * Checks: (1) any bounds corner inside polygon, (2) any polygon vertex inside bounds,
 * (3) any edge intersection.
 */
export function boundsOverlapsPolygon(
  bounds: GeohashBounds,
  polygon: [number, number][],
): boolean {
  const corners: [number, number][] = [
    [bounds.minLon, bounds.minLat],
    [bounds.maxLon, bounds.minLat],
    [bounds.maxLon, bounds.maxLat],
    [bounds.minLon, bounds.maxLat],
  ]

  // Any bounds corner inside polygon?
  if (corners.some((c) => pointInPolygon(c, polygon))) return true

  // Any polygon vertex inside bounds?
  for (const [px, py] of polygon) {
    if (px >= bounds.minLon && px <= bounds.maxLon && py >= bounds.minLat && py <= bounds.maxLat) {
      return true
    }
  }

  // Check edge intersections between bounds edges and polygon edges
  const boundsEdges: [[number, number], [number, number]][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ]

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const polyEdge: [[number, number], [number, number]] = [polygon[j], polygon[i]]
    for (const boundsEdge of boundsEdges) {
      if (segmentsIntersect(boundsEdge[0], boundsEdge[1], polyEdge[0], polyEdge[1])) {
        return true
      }
    }
  }

  return false
}

/** Test whether two line segments (a1->a2) and (b1->b2) intersect. */
function segmentsIntersect(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number],
): boolean {
  const d1 = cross(b1, b2, a1)
  const d2 = cross(b1, b2, a2)
  const d3 = cross(a1, a2, b1)
  const d4 = cross(a1, a2, b2)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (d1 === 0 && onSegment(b1, b2, a1)) return true
  if (d2 === 0 && onSegment(b1, b2, a2)) return true
  if (d3 === 0 && onSegment(a1, a2, b1)) return true
  if (d4 === 0 && onSegment(a1, a2, b2)) return true

  return false
}

function cross(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function onSegment(a: [number, number], b: [number, number], p: [number, number]): boolean {
  return Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) &&
         Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
}

// --- polygonToGeohashes — recursive subdivision ---

export interface CoverageOptions {
  minPrecision?: number
  maxPrecision?: number
  maxCells?: number
  mergeThreshold?: number
}

/** Internal representation of a polygon with optional holes. */
interface NormalisedPolygon {
  outer: [number, number][]
  holes: [number, number][][]
}

/** Strip closing vertex from a ring if it duplicates the first vertex. */
function stripClosingVertex(ring: [number, number][]): [number, number][] {
  if (ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]) {
    return ring.slice(0, -1)
  }
  return ring
}

/**
 * Normalise a PolygonInput to a NormalisedPolygon with outer ring and holes.
 * - `[number, number][]` → outer ring only, no holes
 * - GeoJSON Polygon → outer ring + inner rings (holes) extracted
 * - GeoJSON MultiPolygon → not handled here (caller processes each polygon separately)
 */
function normalisePolygonInput(input: PolygonInput): NormalisedPolygon {
  if (Array.isArray(input)) {
    return { outer: input, holes: [] }
  }
  if (input.type === 'Polygon') {
    const ring = input.coordinates[0]
    if (!ring || ring.length === 0) {
      throw new Error('GeoJSON Polygon has no outer ring')
    }
    const outer = stripClosingVertex(ring as [number, number][])
    // Extract inner rings (holes), stripping closing vertices and ignoring degenerate rings
    const holes: [number, number][][] = []
    for (let i = 1; i < input.coordinates.length; i++) {
      const holeRing = stripClosingVertex(input.coordinates[i] as [number, number][])
      if (holeRing.length >= 3) {
        holes.push(holeRing)
      }
    }
    return { outer, holes }
  }
  throw new Error(`Unsupported input type: ${(input as { type: string }).type}`)
}

/**
 * Convert a polygon (array of [lon, lat] vertices) to an efficient set of
 * multi-precision geohash strings using recursive subdivision.
 *
 * Edges always subdivide to maxPrecision for a tight boundary. Interior
 * cells use the coarsest precision allowed by mergeThreshold. If the result
 * exceeds maxCells, maxPrecision is stepped down until it fits.
 *
 * Throws RangeError if the polygon cannot be covered within maxCells at
 * the given minPrecision.
 *
 * **Antimeridian:** polygons crossing ±180° longitude are not supported.
 * Split at the antimeridian and cover each half separately.
 */
export function polygonToGeohashes(
  input: PolygonInput,
  options: CoverageOptions = {},
): string[] {
  // Parse and validate options upfront (shared by single and multi paths)
  const { minPrecision: rawMin = 1, maxPrecision: rawMax = 9, maxCells = 500, mergeThreshold: rawThreshold = 1.0 } = options
  if (!Number.isFinite(rawMin)) throw new RangeError(`Invalid minPrecision: ${rawMin}`)
  if (!Number.isFinite(rawMax)) throw new RangeError(`Invalid maxPrecision: ${rawMax}`)
  if (!Number.isFinite(maxCells) || maxCells < 1) throw new RangeError(`Invalid maxCells: ${maxCells}`)
  if (!Number.isFinite(rawThreshold)) throw new RangeError(`Invalid mergeThreshold: ${rawThreshold}`)
  const minPrecision = Math.max(1, Math.min(9, Math.round(rawMin)))
  const maxPrecision = Math.max(minPrecision, Math.min(9, Math.round(rawMax)))
  const threshold = Math.max(0, Math.min(1, rawThreshold))

  // Handle MultiPolygon: global maxCells cap across all child polygons
  if (!Array.isArray(input) && input.type === 'MultiPolygon') {
    if (input.coordinates.length === 0) return []

    // Normalise all children upfront
    const children = input.coordinates.map((polyCoords) =>
      normalisePolygonInput({ type: 'Polygon', coordinates: polyCoords }),
    )

    // Validate all children before computing
    for (const { outer } of children) {
      if (outer.length < 3) {
        throw new Error('Polygon must have at least 3 vertices')
      }
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length
        if (Math.abs(outer[i][0] - outer[j][0]) > 180) {
          throw new Error('Polygons crossing the antimeridian (±180° longitude) are not supported')
        }
      }
    }

    // Retry loop from maxPrecision down to minPrecision
    const bailout = maxCells * 4
    for (let mp = maxPrecision; mp >= minPrecision; mp--) {
      const allHashes: string[] = []
      let bailed = false
      for (const { outer, holes } of children) {
        if (outer.length < 3) continue
        const result = computeGeohashes(outer, holes, minPrecision, mp, threshold, bailout)
        if (result === null) { bailed = true; break }
        allHashes.push(...result)
      }
      if (bailed) continue
      const merged = deduplicateGeohashes(allHashes)
      if (merged.length <= maxCells) return merged
    }

    // Fallback: minPrecision with threshold=0
    const fallbackAll: string[] = []
    for (const { outer, holes } of children) {
      if (outer.length < 3) continue
      const result = computeGeohashes(outer, holes, minPrecision, minPrecision, 0) ?? []
      fallbackAll.push(...result)
    }
    const fallback = deduplicateGeohashes(fallbackAll)
    if (fallback.length <= maxCells) return fallback

    throw new RangeError(
      `MultiPolygon requires at least ${fallback.length} cells at precision ${minPrecision}, but maxCells is ${maxCells}. ` +
      'Increase maxCells or reduce the polygon area.',
    )
  }

  const { outer: polygon, holes } = normalisePolygonInput(input)

  // Guard: degenerate polygons
  if (polygon.length < 3) {
    throw new Error('Polygon must have at least 3 vertices')
  }

  // Guard: antimeridian-crossing polygons are not supported
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    if (Math.abs(polygon[i][0] - polygon[j][0]) > 180) {
      throw new Error('Polygons crossing the antimeridian (±180° longitude) are not supported')
    }
  }

  // Early bailout limit
  const bailout = maxCells * 4

  // Try at requested maxPrecision, stepping down if too many cells
  for (let mp = maxPrecision; mp >= minPrecision; mp--) {
    const result = computeGeohashes(polygon, holes, minPrecision, mp, threshold, bailout)
    if (result !== null && result.length <= maxCells) return result
  }

  // Fallback: minPrecision with threshold=0
  const fallback = computeGeohashes(polygon, holes, minPrecision, minPrecision, 0) ?? []
  if (fallback.length <= maxCells) return fallback

  throw new RangeError(
    `Polygon requires at least ${fallback.length} cells at precision ${minPrecision}, but maxCells is ${maxCells}. ` +
    'Increase maxCells or reduce the polygon area.',
  )
}

/**
 * Compute geohashes covering a polygon via greedy recursive subdivision.
 *
 * - Edges always subdivide to maxPrecision (tight boundary).
 * - Interior cells emit at the coarsest precision allowed by coverageThreshold.
 *   threshold 1.0 → interior at maxPrecision (uniform cells, most cells).
 *   threshold 0.0 → interior at minPrecision (coarsest blocks, fewest cells).
 * - Only fully-inside cells are emitted below maxPrecision, so no blocks
 *   extend outside the polygon boundary.
 */
function computeGeohashes(
  polygon: [number, number][],
  holes: [number, number][][],
  minPrecision: number,
  maxPrecision: number,
  coverageThreshold: number,
  bailout?: number,
): string[] | null {
  const result: string[] = []
  const limit = bailout ?? Infinity
  const hasHoles = holes.length > 0

  // Pre-compute polygon AABB for fast rejection.
  let polyMinLon = Infinity, polyMaxLon = -Infinity
  let polyMinLat = Infinity, polyMaxLat = -Infinity
  for (const [lon, lat] of polygon) {
    if (lon < polyMinLon) polyMinLon = lon
    if (lon > polyMaxLon) polyMaxLon = lon
    if (lat < polyMinLat) polyMinLat = lat
    if (lat > polyMaxLat) polyMaxLat = lat
  }

  /**
   * Check if bounds are fully inside the outer polygon and not fully inside any hole.
   * A cell is "fully inside" the effective polygon when:
   * - all corners are inside the outer ring, AND
   * - the cell does not overlap any hole
   */
  const isFullyInside = (b: GeohashBounds): boolean => {
    if (!boundsFullyInsidePolygon(b, polygon)) return false
    if (hasHoles) {
      for (const hole of holes) {
        if (boundsOverlapsPolygon(b, hole)) return false
      }
    }
    return true
  }

  /**
   * Check if bounds overlap the effective polygon (outer minus holes).
   * A cell overlaps when it overlaps the outer ring AND is not fully inside any hole.
   */
  const doesOverlap = (b: GeohashBounds): boolean => {
    if (!boundsOverlapsPolygon(b, polygon)) return false
    if (hasHoles) {
      for (const hole of holes) {
        if (boundsFullyInsidePolygon(b, hole)) return false
      }
    }
    return true
  }

  // Interior cells must reach at least this precision before being emitted.
  // At threshold 1.0 → all cells at maxPrecision (uniform).
  // At threshold 0.0 → interior cells as coarse as minPrecision.
  const interiorMinPrecision = Math.ceil(
    minPrecision + (maxPrecision - minPrecision) * coverageThreshold,
  )

  // Seed: precision-1 cells filtered by AABB then polygon overlap.
  const queue = geohashChildren('').filter((hash) => {
    const b = geohashBounds(hash)
    if (b.maxLon < polyMinLon || b.minLon > polyMaxLon ||
        b.maxLat < polyMinLat || b.minLat > polyMaxLat) return false
    return doesOverlap(b)
  })

  while (queue.length > 0) {
    const hash = queue.pop()!
    const b = geohashBounds(hash)

    if (isFullyInside(b)) {
      if (hash.length >= interiorMinPrecision) {
        result.push(hash)
      } else {
        for (const child of geohashChildren(hash)) {
          queue.push(child)
        }
      }
    } else if (hash.length >= maxPrecision) {
      // At max precision: only emit if it overlaps the effective polygon
      if (doesOverlap(b)) {
        result.push(hash)
      }
    } else {
      for (const child of geohashChildren(hash)) {
        const cb = geohashBounds(child)
        // Fast AABB rejection before expensive polygon checks
        if (cb.maxLon < polyMinLon || cb.minLon > polyMaxLon ||
            cb.maxLat < polyMinLat || cb.minLat > polyMaxLat) continue
        if (isFullyInside(cb)) {
          if (child.length >= interiorMinPrecision) {
            result.push(child)
          } else {
            queue.push(child)
          }
        } else if (doesOverlap(cb)) {
          queue.push(child)
        }
      }
    }

    if (result.length > limit) return null
  }

  // Map coverageThreshold to merge aggressiveness:
  // threshold 1.0 (tight) → require all 32 siblings (exact boundary)
  // threshold 0.0 (loose) → require only 24 siblings (aggressive merge, fewer cells)
  const minSiblings = Math.round(24 + coverageThreshold * 8)

  return mergeCompleteSiblings(result, minPrecision, minSiblings).sort()
}

/**
 * Post-processing merge: bottom-up consolidation of sibling sets.
 * When at least `minSiblings` of 32 children of a parent are present,
 * replace them with the parent. With `minSiblings < 32` this trades a
 * tiny boundary overshoot for a significantly smaller result array.
 * Iterates from finest to coarsest so merges can cascade.
 */
function mergeCompleteSiblings(hashes: string[], minPrecision: number, minSiblings = 30): string[] {
  const set = new Set(hashes)
  let maxP = 0
  for (const h of set) {
    if (h.length > maxP) maxP = h.length
  }

  for (let p = maxP; p > minPrecision; p--) {
    const parentCounts = new Map<string, number>()
    for (const h of set) {
      if (h.length === p) {
        const parent = h.slice(0, -1)
        parentCounts.set(parent, (parentCounts.get(parent) ?? 0) + 1)
      }
    }

    for (const [parent, count] of parentCounts) {
      if (count >= minSiblings) {
        // Near-complete or complete — replace children with parent
        for (const ch of geohashChildren(parent)) {
          set.delete(ch)
        }
        set.add(parent)
      }
    }
  }

  return Array.from(set)
}

// --- geohashesToConvexHull — reconstruct editable polygon ---

/** 2D cross product of vectors OA and OB where O is the origin. */
function cross2D(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

/**
 * Compute a convex hull polygon from an array of geohash strings.
 * Collects all unique cell corners, then builds the hull using
 * Andrew's monotone chain algorithm.
 * Returns `[lon, lat][]`.
 *
 * **Antimeridian:** throws if the input hashes straddle ±180° longitude.
 * Dateline-crossing hulls cannot be consumed by planar geometry functions
 * (`pointInPolygon`, `polygonToGeohashes`). Split hash sets at the
 * antimeridian and compute separate hulls for each side.
 */
export function geohashesToConvexHull(hashes: string[]): [number, number][] {
  if (hashes.length === 0) return []

  // Collect unique corners from all geohash bounding boxes
  const seen = new Set<string>()
  const points: [number, number][] = []

  for (const hash of hashes) {
    const b = geohashBounds(hash)
    const corners: [number, number][] = [
      [b.minLon, b.minLat],
      [b.maxLon, b.minLat],
      [b.maxLon, b.maxLat],
      [b.minLon, b.maxLat],
    ]
    for (const c of corners) {
      const key = `${c[0]},${c[1]}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push(c)
      }
    }
  }

  if (points.length < 3) return points

  // Guard: antimeridian-straddling hashes produce hulls that break planar geometry
  const lons = points.map(p => p[0])
  if (Math.max(...lons) - Math.min(...lons) > 180) {
    throw new Error(
      'Geohashes straddle the antimeridian (±180° longitude). ' +
      'Split into separate sets and compute hulls independently.',
    )
  }

  // Sort by x then y
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1])

  // Andrew's monotone chain — lower hull
  const lower: [number, number][] = []
  for (const p of points) {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }

  // Upper hull
  const upper: [number, number][] = []
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i]
    while (upper.length >= 2 && cross2D(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }

  // Remove last point of each half because it's repeated
  lower.pop()
  upper.pop()

  return [...lower, ...upper]
}

// --- deduplicateGeohashes ---

export interface DeduplicateOptions {
  /**
   * Allow near-complete sibling merges (30/32) for a smaller result array.
   * Trades a tiny boundary overshoot for fewer cells. Default: `false` (exact).
   */
  lossy?: boolean
}

/**
 * Remove redundant geohashes and merge sibling groups.
 * 1. Remove any geohash whose ancestor (shorter prefix) is already in the set.
 * 2. Merge sibling sets bottom-up — exact (all 32) by default, or
 *    near-complete (≥30/32) when `lossy: true`.
 */
export function deduplicateGeohashes(hashes: string[], options: DeduplicateOptions = {}): string[] {
  // Step 1: remove children when ancestor is present
  const set = new Set(hashes)
  const filtered = Array.from(set).filter((h) => {
    for (let len = 1; len < h.length; len++) {
      if (set.has(h.slice(0, len))) return false
    }
    return true
  })

  // Step 2: merge sibling groups bottom-up
  const minSiblings = options.lossy ? 30 : 32
  return mergeCompleteSiblings(filtered, 1, minSiblings).sort()
}

// --- geohashesToGeoJSON ---

export interface GeohashGeoJSON {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: { type: 'Polygon'; coordinates: [number, number][][] }
    properties: { geohash: string; precision: number }
  }[]
}

/**
 * Convert an array of geohash strings to a GeoJSON FeatureCollection
 * of polygon rectangles, suitable for rendering on a MapLibre map.
 */
export function geohashesToGeoJSON(hashes: string[]): GeohashGeoJSON {
  return {
    type: 'FeatureCollection',
    features: hashes.map((hash) => {
      const b = geohashBounds(hash)
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [b.minLon, b.minLat],
            [b.maxLon, b.minLat],
            [b.maxLon, b.maxLat],
            [b.minLon, b.maxLat],
            [b.minLon, b.minLat],
          ]],
        },
        properties: { geohash: hash, precision: hash.length },
      }
    }),
  }
}
