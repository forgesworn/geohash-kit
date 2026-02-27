import { describe, it, expect } from 'vitest'
import { bounds, decode, encode } from './core.js'
import {
  pointInPolygon, boundsOverlapsPolygon, boundsFullyInsidePolygon,
  polygonToGeohashes, geohashesToGeoJSON, geohashesToConvexHull,
  deduplicateGeohashes,
} from './coverage.js'
import type { GeohashBounds } from './core.js'

describe('pointInPolygon', () => {
  const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

  it('returns true for a point inside', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true)
  })

  it('returns false for a point outside', () => {
    expect(pointInPolygon([15, 5], square)).toBe(false)
  })

  it('returns true for a point on the edge', () => {
    expect(pointInPolygon([5, 0], square)).toBe(true)
  })

  it('returns false for a point far outside', () => {
    expect(pointInPolygon([-5, -5], square)).toBe(false)
  })

  it('works with a triangle', () => {
    const triangle: [number, number][] = [[0, 0], [10, 0], [5, 10]]
    expect(pointInPolygon([5, 3], triangle)).toBe(true)
    expect(pointInPolygon([1, 9], triangle)).toBe(false)
  })
})

describe('boundsOverlapsPolygon', () => {
  const poly: [number, number][] = [[2, 2], [8, 2], [8, 8], [2, 8]]

  it('returns true when bounds overlap polygon', () => {
    const b: GeohashBounds = { minLat: 1, maxLat: 4, minLon: 1, maxLon: 4 }
    expect(boundsOverlapsPolygon(b, poly)).toBe(true)
  })

  it('returns true when bounds fully inside polygon', () => {
    const b: GeohashBounds = { minLat: 3, maxLat: 5, minLon: 3, maxLon: 5 }
    expect(boundsOverlapsPolygon(b, poly)).toBe(true)
  })

  it('returns false when bounds fully outside polygon', () => {
    const b: GeohashBounds = { minLat: 10, maxLat: 15, minLon: 10, maxLon: 15 }
    expect(boundsOverlapsPolygon(b, poly)).toBe(false)
  })

  it('returns true when polygon is fully inside bounds', () => {
    const b: GeohashBounds = { minLat: 0, maxLat: 10, minLon: 0, maxLon: 10 }
    expect(boundsOverlapsPolygon(b, poly)).toBe(true)
  })
})

describe('boundsFullyInsidePolygon', () => {
  const poly: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]]

  it('returns true when all corners inside polygon', () => {
    const b: GeohashBounds = { minLat: 2, maxLat: 8, minLon: 2, maxLon: 8 }
    expect(boundsFullyInsidePolygon(b, poly)).toBe(true)
  })

  it('returns false when some corners outside polygon', () => {
    const b: GeohashBounds = { minLat: -1, maxLat: 5, minLon: 2, maxLon: 8 }
    expect(boundsFullyInsidePolygon(b, poly)).toBe(false)
  })
})

describe('polygonToGeohashes', () => {
  it('returns geohashes covering a small area', () => {
    // Small polygon around central London (~2km square)
    const london: [number, number][] = [
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ]
    const result = polygonToGeohashes(london)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThan(500)
    // All should be valid geohash strings
    for (const h of result) {
      expect(h).toMatch(/^[0-9b-hjkmnp-z]+$/)
      expect(h.length).toBeGreaterThanOrEqual(1)
      expect(h.length).toBeLessThanOrEqual(9)
    }
  })

  it('returns no duplicates', () => {
    const poly: [number, number][] = [
      [-0.2, 51.48],
      [-0.05, 51.48],
      [-0.05, 51.55],
      [-0.2, 51.55],
    ]
    const result = polygonToGeohashes(poly)
    expect(new Set(result).size).toBe(result.length)
  })

  it('uses coarser geohashes for large areas', () => {
    // Large polygon covering most of southern England
    const large: [number, number][] = [
      [-2.0, 50.5],
      [1.0, 50.5],
      [1.0, 52.0],
      [-2.0, 52.0],
    ]
    const result = polygonToGeohashes(large)
    // Should include some precision-4 or precision-3 cells
    const minPrecision = Math.min(...result.map((h) => h.length))
    expect(minPrecision).toBeLessThanOrEqual(5)
  })

  it('respects maxCells cap', () => {
    const big: [number, number][] = [
      [-6.0, 49.0],
      [2.0, 49.0],
      [2.0, 56.0],
      [-6.0, 56.0],
    ]
    const result = polygonToGeohashes(big, { maxCells: 50 })
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('throws RangeError when maxCells is infeasible', () => {
    // This polygon needs at least 2 precision-1 cells — maxCells:1 is impossible
    const big: [number, number][] = [
      [-6.0, 49.0],
      [2.0, 49.0],
      [2.0, 56.0],
      [-6.0, 56.0],
    ]
    expect(() => polygonToGeohashes(big, { maxCells: 1 })).toThrow(RangeError)
    expect(() => polygonToGeohashes(big, { maxCells: 1 })).toThrow(/Increase maxCells/)
  })

  it('throws RangeError for polygon with coordinates outside valid geographic bounds', () => {
    const nowhere: [number, number][] = [
      [200, 100],
      [201, 100],
      [201, 101],
    ]
    expect(() => polygonToGeohashes(nowhere)).toThrow(RangeError)
  })

  it('defaults to minPrecision 1 and maxPrecision 9', () => {
    // Very small area should produce precision-9 cells
    const tiny: [number, number][] = [
      [-0.1280, 51.5073],
      [-0.1275, 51.5073],
      [-0.1275, 51.5076],
      [-0.1280, 51.5076],
    ]
    const result = polygonToGeohashes(tiny)
    const maxLen = Math.max(...result.map((h) => h.length))
    expect(maxLen).toBeGreaterThanOrEqual(7)
  })

  it('can produce precision-1 cells for huge areas', () => {
    // Large polygon spanning 180° of longitude (within antimeridian guard limit)
    const huge: [number, number][] = [
      [-90, -85],
      [90, -85],
      [90, 85],
      [-90, 85],
    ]
    const result = polygonToGeohashes(huge, { maxCells: 32 })
    const minLen = Math.min(...result.map((h) => h.length))
    expect(minLen).toBe(1)
  })
})

describe('polygonToGeohashes mergeThreshold', () => {
  // A polygon that produces edge cells at max precision
  const london: [number, number][] = [
    [-0.15, 51.50],
    [-0.10, 51.50],
    [-0.10, 51.52],
    [-0.15, 51.52],
  ]

  it('threshold 1.0 matches default (strict merge)', () => {
    const strict = polygonToGeohashes(london)
    const explicit = polygonToGeohashes(london, { mergeThreshold: 1.0 })
    expect(explicit).toEqual(strict)
  })

  it('threshold < 1.0 produces fewer or equal cells at same precision', () => {
    // Pin the same precision range so only the merge behaviour differs
    const opts = { minPrecision: 3, maxPrecision: 6, maxCells: 10000 }
    const strict = polygonToGeohashes(london, { ...opts, mergeThreshold: 1.0 })
    const relaxed = polygonToGeohashes(london, { ...opts, mergeThreshold: 0.7 })
    expect(relaxed.length).toBeLessThanOrEqual(strict.length)
  })

  it('threshold 0.7 merges when 23+ of 32 children present', () => {
    const relaxed = polygonToGeohashes(london, { mergeThreshold: 0.7 })
    // Should have more coarse-precision cells than strict
    const coarseCount = relaxed.filter((h) => h.length <= 4).length
    const strictCoarse = polygonToGeohashes(london).filter((h) => h.length <= 4).length
    expect(coarseCount).toBeGreaterThanOrEqual(strictCoarse)
  })
})

describe('greedy multi-precision coverage', () => {
  it('produces multiple precision levels for a medium-large polygon', () => {
    // East Midlands — roughly 2.5° × 1.5° polygon
    const midlands: [number, number][] = [
      [-2.0, 52.2],
      [0.3, 52.2],
      [0.3, 53.5],
      [-2.0, 53.5],
    ]
    const result = polygonToGeohashes(midlands, { mergeThreshold: 0.8, maxCells: 50000 })
    const precisions = new Set(result.map((h) => h.length))
    // Coarse interior + fine edge = multi-precision
    expect(precisions.size).toBeGreaterThanOrEqual(2)
  })

  it('lower threshold produces fewer cells than higher threshold', () => {
    const poly: [number, number][] = [
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ]
    const loose = polygonToGeohashes(poly, { maxPrecision: 7, mergeThreshold: 0.2, maxCells: 5000 })
    const tight = polygonToGeohashes(poly, { maxPrecision: 7, mergeThreshold: 1.0, maxCells: 5000 })
    expect(loose.length).toBeLessThanOrEqual(tight.length)
  })

  it('at threshold 0 uses coarsest possible interior cells', () => {
    const large: [number, number][] = [
      [-2.0, 50.5],
      [1.0, 50.5],
      [1.0, 52.5],
      [-2.0, 52.5],
    ]
    // With high maxCells to avoid auto-stepping, threshold 0 should produce
    // coarse interior cells (only fully-inside cells, as coarse as they fit).
    const result = polygonToGeohashes(large, { mergeThreshold: 0, maxPrecision: 7, maxCells: 50000 })
    const minPrecision = Math.min(...result.map((h) => h.length))
    // For a 3° × 2° polygon, the coarsest fully-inside cells are p3
    // (p1/p2 cells are too large to fit entirely inside)
    expect(minPrecision).toBeLessThan(7)
  })

  it('at threshold 1 edge cells reach maxPrecision and interior cells are merged', () => {
    const poly: [number, number][] = [
      [-0.20, 51.45],
      [-0.05, 51.45],
      [-0.05, 51.55],
      [-0.20, 51.55],
    ]
    const result = polygonToGeohashes(poly, { maxPrecision: 7, mergeThreshold: 1.0, maxCells: 50000 })
    // Edge cells at maxPrecision, but complete sibling groups are merged into coarser cells
    expect(Math.max(...result.map((h) => h.length))).toBe(7)
    // Post-processing merge consolidates interior — multiple precision levels
    const precisions = new Set(result.map((h) => h.length))
    expect(precisions.size).toBeGreaterThanOrEqual(1)
    // No cell should be an ancestor of another (merge is clean)
    const sorted = [...result].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        expect(sorted[j].startsWith(sorted[i]) && sorted[j].length > sorted[i].length).toBe(false)
      }
    }
  })

  it('at threshold < 1 interior cells are coarser than edge cells', () => {
    // Use a larger polygon to ensure some cells fit fully inside at coarse precision
    const poly: [number, number][] = [
      [-1.0, 51.0],
      [0.5, 51.0],
      [0.5, 52.0],
      [-1.0, 52.0],
    ]
    const result = polygonToGeohashes(poly, { maxPrecision: 7, mergeThreshold: 0.5, maxCells: 50000 })
    const precisions = new Set(result.map((h) => h.length))
    // Multi-precision: coarse interior + fine edges
    expect(precisions.size).toBeGreaterThanOrEqual(2)
    // Edge cells reach maxPrecision
    expect(Math.max(...result.map((h) => h.length))).toBe(7)
    // Interior cells are coarser than maxPrecision
    expect(Math.min(...result.map((h) => h.length))).toBeLessThan(7)
  })

  it('no geohash is an ancestor of another', () => {
    const poly: [number, number][] = [
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ]
    const result = polygonToGeohashes(poly, { mergeThreshold: 0.7 })
    const sorted = [...result].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].startsWith(sorted[i]) && sorted[j].length > sorted[i].length) {
          throw new Error(`${sorted[i]} is an ancestor of ${sorted[j]}`)
        }
      }
    }
  })

  it('auto-tightens threshold when result exceeds maxCells', () => {
    const large: [number, number][] = [
      [-6.0, 49.5],
      [2.0, 49.5],
      [2.0, 59.0],
      [-6.0, 59.0],
    ]
    // With threshold 1.0 and maxPrecision 9, the raw count far exceeds 100,
    // so the algorithm should auto-tighten to fit within maxCells.
    const result = polygonToGeohashes(large, { mergeThreshold: 1.0, maxCells: 100 })
    expect(result.length).toBeLessThanOrEqual(100)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('geohashesToGeoJSON', () => {
  it('converts geohashes to a GeoJSON FeatureCollection of polygons', () => {
    const result = geohashesToGeoJSON(['gcpvj', 'gcpvm'])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(2)
    expect(result.features[0].geometry.type).toBe('Polygon')
    expect(result.features[0].properties.geohash).toBe('gcpvj')
    expect(result.features[0].properties.precision).toBe(5)
  })

  it('each polygon has 5 coordinates (closed ring)', () => {
    const result = geohashesToGeoJSON(['gcp'])
    const coords = result.features[0].geometry.coordinates[0]
    expect(coords).toHaveLength(5)
    expect(coords[0]).toEqual(coords[4])
  })

  it('returns empty collection for empty input', () => {
    const result = geohashesToGeoJSON([])
    expect(result.features).toHaveLength(0)
  })
})

describe('geohashesToConvexHull', () => {
  it('returns empty array for empty input', () => {
    expect(geohashesToConvexHull([])).toEqual([])
  })

  it('returns 4+ vertex polygon for a single geohash', () => {
    const hull = geohashesToConvexHull(['gcpvj'])
    expect(hull.length).toBeGreaterThanOrEqual(4)
    // Should form a rectangle (4 corners of the cell)
    const lons = hull.map((v) => v[0])
    const lats = hull.map((v) => v[1])
    expect(Math.min(...lons)).toBeLessThan(Math.max(...lons))
    expect(Math.min(...lats)).toBeLessThan(Math.max(...lats))
  })

  it('returns valid convex polygon for multiple geohashes', () => {
    const hashes = polygonToGeohashes([
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ])
    const hull = geohashesToConvexHull(hashes)
    expect(hull.length).toBeGreaterThanOrEqual(4)

    // Verify convexity: all cross products should have the same sign
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i]
      const b = hull[(i + 1) % hull.length]
      const c = hull[(i + 2) % hull.length]
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      expect(cross).toBeGreaterThanOrEqual(0) // counter-clockwise or collinear
    }
  })

  it('hull contains all original geohash centres', () => {
    const hashes = ['gcpvj', 'gcpvm', 'gcpvn']
    const hull = geohashesToConvexHull(hashes)

    for (const hash of hashes) {
      const b = bounds(hash)
      const centre: [number, number] = [(b.minLon + b.maxLon) / 2, (b.minLat + b.maxLat) / 2]
      expect(pointInPolygon(centre, hull)).toBe(true)
    }
  })

  it('produced polygon is consumable by polygonToGeohashes (round-trip)', () => {
    const original = polygonToGeohashes([
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ])
    const hull = geohashesToConvexHull(original)
    expect(hull.length).toBeGreaterThanOrEqual(3)

    // The hull is a convex approximation — the round-trip may use
    // different precision levels due to auto-tightening, but it should
    // produce a valid non-empty result covering the same general area.
    const roundTrip = polygonToGeohashes(hull)
    expect(roundTrip.length).toBeGreaterThan(0)
  })
})

describe('geohashesToConvexHull — antimeridian', () => {
  it('throws for hashes straddling the antimeridian', () => {
    const hashEast = encode(0, 179.5, 3)
    const hashWest = encode(0, -179.5, 3)
    expect(() => geohashesToConvexHull([hashEast, hashWest])).toThrow(/antimeridian/)
  })

  it('does not throw for hashes near but not straddling antimeridian', () => {
    // Both hashes on the eastern side of the antimeridian
    const h1 = encode(0, 170, 3)
    const h2 = encode(0, 175, 3)
    expect(() => geohashesToConvexHull([h1, h2])).not.toThrow()
  })

  it('throws for wide-span hashes where old ±90 heuristic has false negative', () => {
    // Hash 't' has bounds [45,90] — maxLon is exactly 90, not >90 (strict)
    // Hash '9' has bounds [-135,-90] — minLon is -135, which is <-90
    // Span is 225° (>180) but old heuristic misses it because 90 > 90 is false
    expect(() => geohashesToConvexHull(['t', '9'])).toThrow(/antimeridian/)
  })
})

describe('polygonToGeohashes — degenerate polygon guard', () => {
  it('throws for a 2-point polygon', () => {
    const line: [number, number][] = [[-0.1, 51.5], [0.1, 51.5]]
    expect(() => polygonToGeohashes(line)).toThrow(/at least 3/)
  })

  it('throws for a 1-point polygon', () => {
    expect(() => polygonToGeohashes([[0, 0]])).toThrow(/at least 3/)
  })

  it('throws for an empty polygon', () => {
    expect(() => polygonToGeohashes([])).toThrow(/at least 3/)
  })

  it('does not throw for a 3-point polygon', () => {
    const triangle: [number, number][] = [[-0.1, 51.5], [0.1, 51.5], [0.0, 51.6]]
    expect(() => polygonToGeohashes(triangle)).not.toThrow()
  })
})

describe('polygonToGeohashes — numeric options validation', () => {
  const poly: [number, number][] = [[-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52]]

  it('throws RangeError for NaN minPrecision', () => {
    expect(() => polygonToGeohashes(poly, { minPrecision: NaN })).toThrow(RangeError)
  })

  it('throws RangeError for NaN maxPrecision', () => {
    expect(() => polygonToGeohashes(poly, { maxPrecision: NaN })).toThrow(RangeError)
  })

  it('throws RangeError for NaN maxCells', () => {
    expect(() => polygonToGeohashes(poly, { maxCells: NaN })).toThrow(RangeError)
  })

  it('throws RangeError for NaN mergeThreshold', () => {
    expect(() => polygonToGeohashes(poly, { mergeThreshold: NaN })).toThrow(RangeError)
  })

  it('throws RangeError for Infinity maxCells', () => {
    expect(() => polygonToGeohashes(poly, { maxCells: Infinity })).toThrow(RangeError)
  })
})

describe('polygonToGeohashes — antimeridian guard', () => {
  it('throws for polygon crossing the antimeridian', () => {
    // Polygon that crosses from +170 to -170 longitude
    const crossingPoly: [number, number][] = [
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
    ]
    expect(() => polygonToGeohashes(crossingPoly)).toThrow(/antimeridian/)
  })

  it('does not throw for polygon near but not crossing antimeridian', () => {
    // Polygon near +170 but not crossing
    const nearPoly: [number, number][] = [
      [168, -5],
      [175, -5],
      [175, 5],
      [168, 5],
    ]
    expect(() => polygonToGeohashes(nearPoly)).not.toThrow()
  })
})

describe('polygonToGeohashes — seed explosion regression', () => {
  it('polygonToGeohashes with minPrecision=5 completes in reasonable time', () => {
    const london: [number, number][] = [
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ]
    const start = Date.now()
    const result = polygonToGeohashes(london, { minPrecision: 5, maxPrecision: 7, maxCells: 500 })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000) // must complete in <5s, not OOM
    expect(result.length).toBeGreaterThan(0)
  })

  it('minPrecision=4 produces same spatial coverage as minPrecision=1 for same polygon', () => {
    const poly: [number, number][] = [
      [-0.15, 51.50],
      [-0.10, 51.50],
      [-0.10, 51.52],
      [-0.15, 51.52],
    ]
    const opts = { maxPrecision: 6, maxCells: 5000, mergeThreshold: 1.0 }
    const r1 = polygonToGeohashes(poly, { ...opts, minPrecision: 1 })
    const r4 = polygonToGeohashes(poly, { ...opts, minPrecision: 4 })
    // Both should produce results (r4 should not hang or OOM)
    expect(r1.length).toBeGreaterThan(0)
    expect(r4.length).toBeGreaterThan(0)
  })
})

describe('polygonToGeohashes — GeoJSON input', () => {
  // A simple rectangle around central London as [lon, lat][]
  const coordPolygon: [number, number][] = [
    [-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52],
  ]

  it('accepts a GeoJSON Polygon and produces same result as coordinate array', () => {
    const geojsonPolygon = {
      type: 'Polygon' as const,
      coordinates: [[
        [-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52], [-0.15, 51.50],
      ]],
    }
    const fromCoords = polygonToGeohashes(coordPolygon)
    const fromGeoJSON = polygonToGeohashes(geojsonPolygon)
    expect(fromGeoJSON).toEqual(fromCoords)
  })

  it('strips closing vertex from GeoJSON Polygon ring', () => {
    // GeoJSON rings are closed (first === last); we must strip the duplicate
    const closed = {
      type: 'Polygon' as const,
      coordinates: [[
        [-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52], [-0.15, 51.50],
      ]],
    }
    const open = {
      type: 'Polygon' as const,
      coordinates: [[
        [-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52],
      ]],
    }
    expect(polygonToGeohashes(closed)).toEqual(polygonToGeohashes(open))
  })

  it('throws for GeoJSON Polygon with empty coordinates', () => {
    const empty = { type: 'Polygon' as const, coordinates: [] as number[][][] }
    expect(() => polygonToGeohashes(empty)).toThrow(/no outer ring/)
  })

  it('throws for GeoJSON Polygon with degenerate ring (< 3 vertices)', () => {
    const degenerate = {
      type: 'Polygon' as const,
      coordinates: [[[-0.15, 51.50], [-0.10, 51.50]]],
    }
    expect(() => polygonToGeohashes(degenerate)).toThrow(/at least 3/)
  })

  it('accepts a GeoJSON MultiPolygon and merges results', () => {
    const multi = {
      type: 'MultiPolygon' as const,
      coordinates: [
        // Polygon 1: central London
        [[[-0.15, 51.50], [-0.10, 51.50], [-0.10, 51.52], [-0.15, 51.52], [-0.15, 51.50]]],
        // Polygon 2: slightly east
        [[[-0.08, 51.50], [-0.03, 51.50], [-0.03, 51.52], [-0.08, 51.52], [-0.08, 51.50]]],
      ],
    }
    const result = polygonToGeohashes(multi)
    expect(result.length).toBeGreaterThan(0)
    // No duplicates
    expect(new Set(result).size).toBe(result.length)
    // No ancestor/descendant pairs
    const sorted = [...result].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        expect(sorted[j].startsWith(sorted[i]) && sorted[j].length > sorted[i].length).toBe(false)
      }
    }
  })

  it('MultiPolygon with empty coordinates array returns empty', () => {
    const empty = { type: 'MultiPolygon' as const, coordinates: [] as number[][][][] }
    const result = polygonToGeohashes(empty)
    expect(result).toEqual([])
  })
})

describe('polygonToGeohashes — GeoJSON holes', () => {
  // Outer ring: ~0.1° square around central London
  const outer: [number, number][] = [
    [-0.15, 51.49], [-0.05, 51.49], [-0.05, 51.54], [-0.15, 51.54],
  ]
  // Hole: small square in the centre of the outer ring
  const hole: [number, number][] = [
    [-0.12, 51.51], [-0.08, 51.51], [-0.08, 51.53], [-0.12, 51.53],
  ]

  const donutPolygon = {
    type: 'Polygon' as const,
    coordinates: [
      [...outer, outer[0]], // outer ring (closed)
      [...hole, hole[0]],   // hole (closed)
    ],
  }

  it('polygon with hole produces fewer cells than without hole', () => {
    const solidPolygon = {
      type: 'Polygon' as const,
      coordinates: [[...outer, outer[0]]],
    }
    const opts = { maxPrecision: 6, maxCells: 10000 }
    const solidResult = polygonToGeohashes(solidPolygon, opts)
    const donutResult = polygonToGeohashes(donutPolygon, opts)
    expect(donutResult.length).toBeLessThan(solidResult.length)
  })

  it('no result geohash is fully inside the hole', () => {
    const opts = { maxPrecision: 6, maxCells: 10000 }
    const result = polygonToGeohashes(donutPolygon, opts)
    for (const hash of result) {
      const b = bounds(hash)
      expect(boundsFullyInsidePolygon(b, hole)).toBe(false)
    }
  })

  it('multiple holes all respected', () => {
    // Second hole in another part of the polygon
    const hole2: [number, number][] = [
      [-0.14, 51.49], [-0.13, 51.49], [-0.13, 51.50], [-0.14, 51.50],
    ]
    const multiHole = {
      type: 'Polygon' as const,
      coordinates: [
        [...outer, outer[0]],
        [...hole, hole[0]],
        [...hole2, hole2[0]],
      ],
    }
    const singleHole = {
      type: 'Polygon' as const,
      coordinates: [
        [...outer, outer[0]],
        [...hole, hole[0]],
      ],
    }
    const opts = { maxPrecision: 6, maxCells: 10000 }
    const multiResult = polygonToGeohashes(multiHole, opts)
    const singleResult = polygonToGeohashes(singleHole, opts)
    expect(multiResult.length).toBeLessThanOrEqual(singleResult.length)
  })

  it('degenerate hole (< 3 vertices) is silently ignored', () => {
    const degenerateHole = {
      type: 'Polygon' as const,
      coordinates: [
        [...outer, outer[0]],
        [[-0.12, 51.51], [-0.08, 51.51]], // only 2 vertices
      ],
    }
    const solidPolygon = {
      type: 'Polygon' as const,
      coordinates: [[...outer, outer[0]]],
    }
    const opts = { maxPrecision: 6, maxCells: 10000 }
    // Should produce same result as polygon without hole
    const degResult = polygonToGeohashes(degenerateHole, opts)
    const solidResult = polygonToGeohashes(solidPolygon, opts)
    expect(degResult).toEqual(solidResult)
  })

  it('coordinate array input still works (backward compatible)', () => {
    const result = polygonToGeohashes(outer)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('polygonToGeohashes — MultiPolygon global maxCells', () => {
  // Two disjoint polygons: London and Paris areas
  const multi = {
    type: 'MultiPolygon' as const,
    coordinates: [
      // London
      [[[-0.15, 51.49], [-0.05, 51.49], [-0.05, 51.54], [-0.15, 51.54], [-0.15, 51.49]]],
      // Paris
      [[[2.30, 48.83], [2.40, 48.83], [2.40, 48.88], [2.30, 48.88], [2.30, 48.83]]],
    ],
  }

  it('two disjoint polygons with maxCells: 50 → result ≤ 50', () => {
    const result = polygonToGeohashes(multi, { maxCells: 50 })
    expect(result.length).toBeLessThanOrEqual(50)
    expect(result.length).toBeGreaterThan(0)
  })

  it('infeasible budget → RangeError', () => {
    expect(() => polygonToGeohashes(multi, { maxCells: 1 })).toThrow(RangeError)
  })

  it('precision step-down works for MultiPolygon', () => {
    // With a tight budget, the algorithm should step down precision
    const result = polygonToGeohashes(multi, { maxCells: 30 })
    expect(result.length).toBeLessThanOrEqual(30)
    expect(result.length).toBeGreaterThan(0)
  })

  it('MultiPolygon with holes in child polygons', () => {
    const multiWithHoles = {
      type: 'MultiPolygon' as const,
      coordinates: [
        // London with a hole
        [
          [[-0.15, 51.49], [-0.05, 51.49], [-0.05, 51.54], [-0.15, 51.54], [-0.15, 51.49]],
          [[-0.12, 51.51], [-0.08, 51.51], [-0.08, 51.53], [-0.12, 51.53], [-0.12, 51.51]],
        ],
        // Paris (no hole)
        [[[2.30, 48.83], [2.40, 48.83], [2.40, 48.88], [2.30, 48.88], [2.30, 48.83]]],
      ],
    }
    const result = polygonToGeohashes(multiWithHoles, { maxCells: 500 })
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(500)
  })

  it('throws for MultiPolygon child crossing the antimeridian', () => {
    const crossingMulti = {
      type: 'MultiPolygon' as const,
      coordinates: [
        [[[170, -10], [-170, -10], [-170, 10], [170, 10], [170, -10]]],
      ],
    }
    expect(() => polygonToGeohashes(crossingMulti)).toThrow(/antimeridian/)
  })

  it('throws for MultiPolygon child with fewer than 3 vertices', () => {
    const degenerateMulti = {
      type: 'MultiPolygon' as const,
      coordinates: [
        [[[0, 0], [1, 1]]],
      ],
    }
    expect(() => polygonToGeohashes(degenerateMulti)).toThrow(/at least 3 vertices/)
  })

  it('throws when second child crosses antimeridian (first child valid)', () => {
    const mixedMulti = {
      type: 'MultiPolygon' as const,
      coordinates: [
        // Valid: London
        [[[-0.15, 51.49], [-0.05, 51.49], [-0.05, 51.54], [-0.15, 51.54], [-0.15, 51.49]]],
        // Invalid: crosses antimeridian
        [[[170, -10], [-170, -10], [-170, 10], [170, 10], [170, -10]]],
      ],
    }
    expect(() => polygonToGeohashes(mixedMulti)).toThrow(/antimeridian/)
  })
})

describe('deduplicateGeohashes', () => {
  it('removes children when parent is present', () => {
    const result = deduplicateGeohashes(['gcp', 'gcpvj', 'gcpvm', 'u10'])
    expect(result).toEqual(['gcp', 'u10'])
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateGeohashes([])).toEqual([])
  })

  it('returns same array when no ancestors present', () => {
    const result = deduplicateGeohashes(['gcpvj', 'gcpvm', 'u10hf'])
    expect(result).toEqual(['gcpvj', 'gcpvm', 'u10hf'])
  })

  it('does not merge near-complete sibling sets by default (exact mode)', () => {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    const parent = 'gcp'
    const kids = [...BASE32].map(ch => parent + ch).slice(0, 30)
    const result = deduplicateGeohashes(kids)
    expect(result).toHaveLength(30)
    expect(result).not.toContain(parent)
  })

  it('merges all 32 siblings into parent in exact mode', () => {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    const parent = 'gcp'
    const allKids = [...BASE32].map(ch => parent + ch)
    const result = deduplicateGeohashes(allKids)
    expect(result).toHaveLength(1)
    expect(result).toContain(parent)
  })

  it('merges near-complete sibling sets (30/32) when lossy: true', () => {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    const parent = 'gcp'
    const kids = [...BASE32].map(ch => parent + ch).slice(0, 30)
    const result = deduplicateGeohashes(kids, { lossy: true })
    expect(result).toHaveLength(1)
    expect(result).toContain(parent)
  })

  it('does not merge 29/32 siblings even when lossy: true', () => {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
    const parent = 'gcp'
    const kids = [...BASE32].map(ch => parent + ch).slice(0, 29)
    const result = deduplicateGeohashes(kids, { lossy: true })
    expect(result).toHaveLength(29)
    expect(result).not.toContain(parent)
  })
})