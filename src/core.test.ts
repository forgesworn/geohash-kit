import { describe, it, expect } from 'vitest'
import {
  encode, decode, bounds, children, contains, matchesAny,
  neighbour, neighbours,
  distance, distanceFromCoords, radiusToPrecision, precisionToRadius,
  midpointFromCoords, midpointFromCoordsMulti, midpoint,
  type GeohashBounds,
} from './core.js'
import { expandRings } from './nostr.js'

describe('encode — input validation', () => {
  it('throws RangeError for Infinity precision', () => {
    expect(() => encode(51.5, -0.1, Infinity)).toThrow(RangeError)
  })

  it('throws RangeError for NaN precision', () => {
    expect(() => encode(51.5, -0.1, NaN)).toThrow(RangeError)
  })

  it('throws RangeError for precision < 1', () => {
    expect(() => encode(51.5, -0.1, 0)).toThrow(RangeError)
    expect(() => encode(51.5, -0.1, -1)).toThrow(RangeError)
  })

  it('rounds float precision to nearest integer', () => {
    expect(encode(51.5074, -0.1278, 4.7).length).toBe(5)
    expect(encode(51.5074, -0.1278, 3.2).length).toBe(3)
  })

  it('clamps precision > 12 to 12', () => {
    expect(encode(51.5074, -0.1278, 15).length).toBe(12)
  })

  it('throws RangeError for NaN latitude', () => {
    expect(() => encode(NaN, -0.1)).toThrow(RangeError)
  })

  it('throws RangeError for Infinity longitude', () => {
    expect(() => encode(51.5, Infinity)).toThrow(RangeError)
  })

  it('throws RangeError for latitude out of range', () => {
    expect(() => encode(91, 0)).toThrow(RangeError)
    expect(() => encode(-91, 0)).toThrow(RangeError)
  })

  it('throws RangeError for longitude out of range', () => {
    expect(() => encode(0, 181)).toThrow(RangeError)
    expect(() => encode(0, -181)).toThrow(RangeError)
  })
})

describe('encode', () => {
  it('encodes London (51.5074, -0.1278) to gcpvj at precision 5', () => {
    expect(encode(51.5074, -0.1278, 5)).toBe('gcpvj')
  })

  it('defaults to precision 5', () => {
    expect(encode(51.5074, -0.1278).length).toBe(5)
  })

  it('respects custom precision', () => {
    const h3 = encode(51.5074, -0.1278, 3)
    const h7 = encode(51.5074, -0.1278, 7)
    expect(h3.length).toBe(3)
    expect(h7.length).toBe(7)
    expect(h7.startsWith(h3)).toBe(true)
  })

  it('encodes equator/prime meridian (0, 0) to s0000', () => {
    expect(encode(0, 0, 5)).toBe('s0000')
  })

  it('encodes extreme coordinates', () => {
    expect(encode(90, -180, 1)).toBe('b')
    expect(encode(-90, 180, 1)).toBe('p')
  })
})

describe('geohash validation', () => {
  it('throws TypeError for invalid characters (!@#)', () => {
    expect(() => bounds('!!!')).toThrow(TypeError)
    expect(() => bounds('abc@')).toThrow(TypeError)
  })

  it('throws TypeError for uppercase (GCPVJ)', () => {
    expect(() => bounds('GCPVJ')).toThrow(TypeError)
  })

  it('throws TypeError for spaces', () => {
    expect(() => bounds('gc pv')).toThrow(TypeError)
  })

  it('accepts all valid base32 characters', () => {
    expect(() => bounds('0123456789bcdefghjkmnpqrstuvwxyz')).not.toThrow()
  })

  it('accepts empty string', () => {
    expect(() => bounds('')).not.toThrow()
  })
})

describe('decode', () => {
  it('decodes gcpvj to approximately (51.51, -0.13)', () => {
    const { lat, lon } = decode('gcpvj')
    expect(lat).toBeCloseTo(51.51, 1)
    expect(lon).toBeCloseTo(-0.13, 1)
  })

  it('returns error margins that shrink with precision', () => {
    const d5 = decode('gcpvj')
    const d7 = decode('gcpvjbs')
    expect(d7.error.lat).toBeLessThan(d5.error.lat)
    expect(d7.error.lon).toBeLessThan(d5.error.lon)
  })

  it('decode is inverse of encode (within error margins)', () => {
    const lat = 51.5074
    const lon = -0.1278
    const hash = encode(lat, lon, 7)
    const decoded = decode(hash)
    expect(Math.abs(decoded.lat - lat)).toBeLessThanOrEqual(decoded.error.lat)
    expect(Math.abs(decoded.lon - lon)).toBeLessThanOrEqual(decoded.error.lon)
  })
})

describe('bounds', () => {
  it('returns full world bounds for empty string', () => {
    expect(bounds('')).toEqual({ minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 })
  })

  it('returns correct bounds for precision-1 geohash "g"', () => {
    const b = bounds('g')
    expect(b.minLat).toBeCloseTo(45, 0)
    expect(b.maxLat).toBeCloseTo(90, 0)
    expect(b.minLon).toBeCloseTo(-45, 0)
    expect(b.maxLon).toBeCloseTo(0, 0)
  })

  it('returns narrower bounds at higher precision', () => {
    const b5 = bounds('gcpvj')
    const b3 = bounds('gcp')
    expect(b5.maxLat - b5.minLat).toBeLessThan(b3.maxLat - b3.minLat)
    expect(b5.maxLon - b5.minLon).toBeLessThan(b3.maxLon - b3.minLon)
  })

  it('bounds contain the decoded centre point', () => {
    const b = bounds('gcpvj')
    const { lat, lon } = decode('gcpvj')
    expect(lat).toBeGreaterThanOrEqual(b.minLat)
    expect(lat).toBeLessThanOrEqual(b.maxLat)
    expect(lon).toBeGreaterThanOrEqual(b.minLon)
    expect(lon).toBeLessThanOrEqual(b.maxLon)
  })
})

describe('children', () => {
  it('returns 32 children for any geohash', () => {
    expect(children('g')).toHaveLength(32)
  })

  it('each child starts with the parent', () => {
    for (const child of children('gcp')) {
      expect(child.startsWith('gcp')).toBe(true)
      expect(child).toHaveLength(4)
    }
  })

  it('children are unique', () => {
    const c = children('gc')
    expect(new Set(c).size).toBe(32)
  })

  it('returns 32 top-level geohashes for empty string', () => {
    const c = children('')
    expect(c).toHaveLength(32)
    expect(c).toContain('g')
    expect(c).toContain('0')
    expect(c).toContain('z')
  })
})

describe('contains', () => {
  it('matches exact same geohash', () => {
    expect(contains('gcvdn', 'gcvdn')).toBe(true)
  })

  it('matches when first is a prefix of second', () => {
    expect(contains('gcvd', 'gcvdn')).toBe(true)
  })

  it('matches when second is a prefix of first', () => {
    expect(contains('gcvdn', 'gcvd')).toBe(true)
  })

  it('rejects sibling cells at same precision', () => {
    expect(contains('gcvdn', 'gcvdp')).toBe(false)
  })

  it('handles single-character precision', () => {
    expect(contains('g', 'gcvdn')).toBe(true)
    expect(contains('u', 'gcvdn')).toBe(false)
  })
})

describe('matchesAny', () => {
  it('matches when candidates contain an exact match', () => {
    expect(matchesAny('gcvdn', ['gcpvj', 'gcvdn', 'u10h'])).toBe(true)
  })

  it('matches when a candidate is a prefix', () => {
    expect(matchesAny('gcvdn', ['gcpvj', 'gcvd', 'u10h'])).toBe(true)
  })

  it('matches when the geohash is a prefix of a candidate', () => {
    expect(matchesAny('gcvd', ['gcpvj', 'gcvdn', 'u10h'])).toBe(true)
  })

  it('rejects when no candidate overlaps', () => {
    expect(matchesAny('gcvdn', ['gcpvj', 'u10h', 'gcwe'])).toBe(false)
  })

  it('handles empty candidates list', () => {
    expect(matchesAny('gcvdn', [])).toBe(false)
  })
})

describe('neighbour', () => {
  it('returns the north neighbour of gcpvj', () => {
    const n = neighbour('gcpvj', 'n')
    expect(n.length).toBe(5)
    expect(n).not.toBe('gcpvj')
    // North neighbour's south boundary should equal gcpvj's north boundary
    const original = bounds('gcpvj')
    const adj = bounds(n)
    expect(adj.minLat).toBeCloseTo(original.maxLat, 10)
  })

  it('returns the east neighbour of gcpvj', () => {
    const e = neighbour('gcpvj', 'e')
    const original = bounds('gcpvj')
    const adj = bounds(e)
    expect(adj.minLon).toBeCloseTo(original.maxLon, 10)
  })

  it('handles precision 1', () => {
    const n = neighbour('s', 'n')
    expect(n.length).toBe(1)
    expect(n).not.toBe('s')
  })

  it('handles antimeridian wrapping (east of z-column)', () => {
    // A geohash near lon 180 should wrap to near lon -180
    const hash = encode(0, 179.99, 3)
    const e = neighbour(hash, 'e')
    const eBounds = bounds(e)
    // The east neighbour should be near -180 (wrapped)
    expect(eBounds.minLon).toBeLessThan(-170)
  })
})

describe('neighbours', () => {
  it('returns 8 distinct neighbours', () => {
    const n = neighbours('gcpvj')
    const values = Object.values(n)
    expect(values).toHaveLength(8)
    expect(new Set(values).size).toBe(8)
    // None should be the original hash
    expect(values).not.toContain('gcpvj')
  })

  it('has correct keys', () => {
    const n = neighbours('gcpvj')
    expect(Object.keys(n).sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
  })

  it('north neighbour bounds are adjacent', () => {
    const n = neighbours('gcpvj')
    const original = bounds('gcpvj')
    const northBounds = bounds(n.n)
    expect(northBounds.minLat).toBeCloseTo(original.maxLat, 10)
  })

  it('all neighbours have the same precision', () => {
    const n = neighbours('gcpvj')
    for (const v of Object.values(n)) {
      expect(v.length).toBe(5)
    }
  })
})

describe('distanceFromCoords — input validation', () => {
  it('throws RangeError for NaN coordinate', () => {
    expect(() => distanceFromCoords(NaN, 0, 0, 0)).toThrow(RangeError)
    expect(() => distanceFromCoords(0, NaN, 0, 0)).toThrow(RangeError)
    expect(() => distanceFromCoords(0, 0, NaN, 0)).toThrow(RangeError)
    expect(() => distanceFromCoords(0, 0, 0, NaN)).toThrow(RangeError)
  })

  it('throws RangeError for Infinity coordinate', () => {
    expect(() => distanceFromCoords(Infinity, 0, 0, 0)).toThrow(RangeError)
    expect(() => distanceFromCoords(0, 0, 0, -Infinity)).toThrow(RangeError)
  })
})

describe('distanceFromCoords', () => {
  it('returns 0 for same point', () => {
    expect(distanceFromCoords(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0)
  })

  it('calculates London to Paris (~340km)', () => {
    const d = distanceFromCoords(51.5074, -0.1278, 48.8566, 2.3522)
    expect(d).toBeGreaterThan(330_000)
    expect(d).toBeLessThan(350_000)
  })

  it('calculates equator distance (1 degree ~111km)', () => {
    const d = distanceFromCoords(0, 0, 0, 1)
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })
})

describe('distance', () => {
  it('returns distance between two geohash cell centres', () => {
    const d = distance('gcpvj', 'u09tu') // London to Paris
    expect(d).toBeGreaterThan(300_000)
    expect(d).toBeLessThan(400_000)
  })

  it('returns 0 for same geohash', () => {
    expect(distance('gcpvj', 'gcpvj')).toBe(0)
  })

  it('returns small distance for adjacent cells', () => {
    const n = neighbour('gcpvj', 'n')
    const d = distance('gcpvj', n)
    // Adjacent precision-5 cells should be within ~5km
    expect(d).toBeLessThan(10_000)
    expect(d).toBeGreaterThan(0)
  })
})

describe('midpointFromCoords — input validation', () => {
  it('throws RangeError for NaN coordinate', () => {
    expect(() => midpointFromCoords(NaN, 0, 0, 0)).toThrow(RangeError)
    expect(() => midpointFromCoords(0, NaN, 0, 0)).toThrow(RangeError)
    expect(() => midpointFromCoords(0, 0, NaN, 0)).toThrow(RangeError)
    expect(() => midpointFromCoords(0, 0, 0, NaN)).toThrow(RangeError)
  })

  it('throws RangeError for Infinity coordinate', () => {
    expect(() => midpointFromCoords(Infinity, 0, 0, 0)).toThrow(RangeError)
    expect(() => midpointFromCoords(0, 0, 0, -Infinity)).toThrow(RangeError)
  })
})

describe('midpointFromCoords', () => {
  it('returns the same point when both inputs are identical', () => {
    const { lat, lon } = midpointFromCoords(51.5074, -0.1278, 51.5074, -0.1278)
    expect(lat).toBeCloseTo(51.5074, 4)
    expect(lon).toBeCloseTo(-0.1278, 4)
  })

  it('calculates midpoint between London and Paris', () => {
    // London: 51.5074, -0.1278  Paris: 48.8566, 2.3522
    // Expected midpoint: approximately (50.19, 1.11) — geographic midpoint on the sphere
    const { lat, lon } = midpointFromCoords(51.5074, -0.1278, 48.8566, 2.3522)
    expect(lat).toBeGreaterThan(49.5)
    expect(lat).toBeLessThan(50.5)
    expect(lon).toBeGreaterThan(0.5)
    expect(lon).toBeLessThan(1.5)
  })

  it('calculates midpoint on the equator', () => {
    const { lat, lon } = midpointFromCoords(0, 0, 0, 10)
    expect(lat).toBeCloseTo(0, 4)
    expect(lon).toBeCloseTo(5, 1)
  })

  it('handles antimeridian crossing', () => {
    // Points on either side of the antimeridian
    const { lat, lon } = midpointFromCoords(0, 170, 0, -170)
    expect(lat).toBeCloseTo(0, 1)
    // Midpoint should be near 180/-180, not near 0
    expect(Math.abs(lon)).toBeGreaterThan(170)
  })

  it('handles north-south midpoint along a meridian', () => {
    const { lat, lon } = midpointFromCoords(60, 10, 20, 10)
    expect(lat).toBeCloseTo(40, 0)
    expect(lon).toBeCloseTo(10, 1)
  })
})

describe('midpointFromCoordsMulti — input validation', () => {
  it('throws RangeError for empty array', () => {
    expect(() => midpointFromCoordsMulti([])).toThrow(RangeError)
  })

  it('throws RangeError for NaN in any point', () => {
    expect(() => midpointFromCoordsMulti([{ lat: NaN, lon: 0 }])).toThrow(RangeError)
    expect(() => midpointFromCoordsMulti([{ lat: 0, lon: 0 }, { lat: 0, lon: NaN }])).toThrow(RangeError)
  })

  it('throws RangeError for Infinity in any point', () => {
    expect(() => midpointFromCoordsMulti([{ lat: Infinity, lon: 0 }])).toThrow(RangeError)
  })
})

describe('midpointFromCoordsMulti', () => {
  it('returns the point itself for a single-element array', () => {
    const { lat, lon } = midpointFromCoordsMulti([{ lat: 51.5074, lon: -0.1278 }])
    expect(lat).toBeCloseTo(51.5074, 4)
    expect(lon).toBeCloseTo(-0.1278, 4)
  })

  it('matches midpointFromCoords for two points', () => {
    const twoPoint = midpointFromCoords(51.5074, -0.1278, 48.8566, 2.3522)
    const multi = midpointFromCoordsMulti([
      { lat: 51.5074, lon: -0.1278 },
      { lat: 48.8566, lon: 2.3522 },
    ])
    expect(multi.lat).toBeCloseTo(twoPoint.lat, 4)
    expect(multi.lon).toBeCloseTo(twoPoint.lon, 4)
  })

  it('calculates centroid of three UK cities', () => {
    // London: 51.5074, -0.1278  Manchester: 53.4808, -2.2426  Edinburgh: 55.9533, -3.1883
    const { lat, lon } = midpointFromCoordsMulti([
      { lat: 51.5074, lon: -0.1278 },
      { lat: 53.4808, lon: -2.2426 },
      { lat: 55.9533, lon: -3.1883 },
    ])
    // Centroid should be roughly in the middle of these three
    expect(lat).toBeGreaterThan(53)
    expect(lat).toBeLessThan(54)
    expect(lon).toBeGreaterThan(-2.5)
    expect(lon).toBeLessThan(-1)
  })

  it('handles antimeridian crossing with multiple points', () => {
    const { lat, lon } = midpointFromCoordsMulti([
      { lat: 0, lon: 170 },
      { lat: 0, lon: -170 },
    ])
    expect(lat).toBeCloseTo(0, 1)
    expect(Math.abs(lon)).toBeGreaterThan(170)
  })
})

describe('midpoint', () => {
  it('returns midpoint between two geohash cell centres', () => {
    // gcpvj = London area, u09tu = Paris area
    const { lat, lon } = midpoint('gcpvj', 'u09tu')
    expect(lat).toBeGreaterThan(49)
    expect(lat).toBeLessThan(51)
    expect(lon).toBeGreaterThan(0)
    expect(lon).toBeLessThan(2)
  })

  it('returns the cell centre for same geohash', () => {
    const decoded = decode('gcpvj')
    const { lat, lon } = midpoint('gcpvj', 'gcpvj')
    expect(lat).toBeCloseTo(decoded.lat, 4)
    expect(lon).toBeCloseTo(decoded.lon, 4)
  })

  it('returns midpoint between adjacent cells', () => {
    const n = neighbour('gcpvj', 'n')
    const { lat, lon } = midpoint('gcpvj', n)
    const aBounds = bounds('gcpvj')
    // Midpoint latitude should be near the shared boundary
    expect(lat).toBeCloseTo(aBounds.maxLat, 1)
  })
})

describe('radiusToPrecision — input validation', () => {
  it('throws RangeError for NaN', () => {
    expect(() => radiusToPrecision(NaN)).toThrow(RangeError)
  })

  it('throws RangeError for Infinity', () => {
    expect(() => radiusToPrecision(Infinity)).toThrow(RangeError)
  })

  it('throws RangeError for negative radius', () => {
    expect(() => radiusToPrecision(-100)).toThrow(RangeError)
  })
})

describe('radiusToPrecision', () => {
  it('returns 1 for very large radius (>2500km)', () => {
    expect(radiusToPrecision(5_000_000)).toBe(1)
  })

  it('returns 5 for ~2.5km radius', () => {
    expect(radiusToPrecision(2_500)).toBe(5)
  })

  it('returns 7 for ~80m radius', () => {
    expect(radiusToPrecision(80)).toBe(7)
  })

  it('returns 9 for very small radius (<3m)', () => {
    expect(radiusToPrecision(2)).toBe(9)
  })

  it('monotonically increases with decreasing radius', () => {
    const radii = [5_000_000, 500_000, 50_000, 5_000, 500, 50, 5]
    const precisions = radii.map(radiusToPrecision)
    for (let i = 1; i < precisions.length; i++) {
      expect(precisions[i]).toBeGreaterThanOrEqual(precisions[i - 1])
    }
  })
})

describe('precisionToRadius — input validation', () => {
  it('throws RangeError for NaN', () => {
    expect(() => precisionToRadius(NaN)).toThrow(RangeError)
  })

  it('throws RangeError for Infinity', () => {
    expect(() => precisionToRadius(Infinity)).toThrow(RangeError)
  })
})

describe('precisionToRadius', () => {
  it('returns large radius for precision 1', () => {
    expect(precisionToRadius(1)).toBeGreaterThan(2_000_000)
  })

  it('returns ~2.4km for precision 5', () => {
    const r = precisionToRadius(5)
    expect(r).toBeGreaterThan(2_000)
    expect(r).toBeLessThan(3_000)
  })

  it('returns small radius for precision 9', () => {
    expect(precisionToRadius(9)).toBeLessThan(5)
  })

  it('is approximate inverse of radiusToPrecision', () => {
    for (let p = 1; p <= 9; p++) {
      const radius = precisionToRadius(p)
      const recovered = radiusToPrecision(radius)
      expect(recovered).toBe(p)
    }
  })
})

// --- Fuzz / property-based tests for neighbour ---

const KNOWN_COORDS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'equator/prime meridian', lat: 0, lon: 0 },
  { name: 'near north pole', lat: 89.0, lon: 10 },
  { name: 'near antimeridian', lat: -33.8688, lon: 179.5 },
]

const CARDINAL_DIRS = ['n', 'e', 's', 'w'] as const

/** Check east/west adjacency, accounting for antimeridian wrapping. */
function isLonAdjacent(edgeA: number, edgeB: number, tol: number): boolean {
  // Normal case: edges are close
  if (Math.abs(edgeA - edgeB) < tol) return true
  // Wrapped case: edges are ~360 apart (one near 180, other near -180)
  if (Math.abs(edgeA - edgeB + 360) < tol) return true
  if (Math.abs(edgeA - edgeB - 360) < tol) return true
  return false
}

/** Check if a cell is near a pole (centre ± cell height would exceed ±90). */
function isNearPole(b: GeohashBounds): boolean {
  const centre = (b.minLat + b.maxLat) / 2
  const height = b.maxLat - b.minLat
  return centre + height > 89.99999 || centre - height < -89.99999
}

describe('fuzz: adjacency invariant across precisions 1–9', () => {
  for (const { name, lat, lon } of KNOWN_COORDS) {
    for (let precision = 1; precision <= 9; precision++) {
      it(`${name} at precision ${precision}`, () => {
        const hash = encode(lat, lon, precision)
        const original = bounds(hash)
        const nbrs = neighbours(hash)
        const nbValues = Object.values(nbrs)
        const nearPole = isNearPole(original)

        // All neighbours have the same precision
        for (const nb of nbValues) {
          expect(nb.length).toBe(precision)
        }

        if (!nearPole) {
          // Away from poles: all 8 neighbours are distinct from each other and the original
          expect(new Set(nbValues).size).toBe(8)
          expect(nbValues).not.toContain(hash)
        }

        // Cardinal neighbours share a boundary edge (within tolerance)
        const TOL = 1e-6

        // North/south adjacency (skip if near pole — clamping distorts)
        if (!nearPole) {
          const northB = bounds(nbrs.n)
          expect(Math.abs(northB.minLat - original.maxLat)).toBeLessThan(TOL)

          const southB = bounds(nbrs.s)
          expect(Math.abs(southB.maxLat - original.minLat)).toBeLessThan(TOL)
        }

        // East/west adjacency (handles antimeridian wrapping)
        const eastB = bounds(nbrs.e)
        expect(isLonAdjacent(eastB.minLon, original.maxLon, TOL)).toBe(true)

        const westB = bounds(nbrs.w)
        expect(isLonAdjacent(westB.maxLon, original.minLon, TOL)).toBe(true)
      })
    }
  }
})

describe('fuzz: round-trip consistency (inverse neighbour)', () => {
  const INVERSE_PAIRS: Array<[Direction, Direction]> = [
    ['n', 's'],
    ['s', 'n'],
    ['e', 'w'],
    ['w', 'e'],
    ['ne', 'sw'],
    ['sw', 'ne'],
    ['nw', 'se'],
    ['se', 'nw'],
  ]

  for (const { name, lat, lon } of KNOWN_COORDS) {
    for (let precision = 1; precision <= 9; precision++) {
      const hash = encode(lat, lon, precision)
      const b = bounds(hash)

      // Skip combos where pole clamping would break the round-trip
      if (isNearPole(b)) continue

      for (const [dir, inverse] of INVERSE_PAIRS) {
        it(`${name} p${precision}: ${dir} then ${inverse} returns to original`, () => {
          const moved = neighbour(hash, dir)
          const returned = neighbour(moved, inverse)
          expect(returned).toBe(hash)
        })
      }
    }
  }
})

describe('fuzz: pole boundary behaviour', () => {
  const POLE_COORDS = [
    { name: 'near north pole', lat: 89.9, lon: 0 },
    { name: 'near north pole (east)', lat: 89.9, lon: 90 },
    { name: 'near south pole', lat: -89.9, lon: 0 },
    { name: 'near south pole (west)', lat: -89.9, lon: -90 },
  ]

  for (const { name, lat, lon } of POLE_COORDS) {
    for (let precision = 1; precision <= 7; precision++) {
      it(`${name} at precision ${precision}: neighbours produce valid geohashes`, () => {
        const hash = encode(lat, lon, precision)
        const nbrs = neighbours(hash)
        const nbValues = Object.values(nbrs)

        // All neighbours are valid geohashes of correct length
        for (const nb of nbValues) {
          expect(nb.length).toBe(precision)
        }

        // East/west neighbours should always differ from original
        expect(nbrs.e).not.toBe(hash)
        expect(nbrs.w).not.toBe(hash)

        // Near poles, north/south may clamp back to same cell — that's OK.
        // At higher precisions where cells are small, they should differ.
        const b = bounds(hash)
        if (!isNearPole(b)) {
          expect(nbrs.n).not.toBe(hash)
          expect(nbrs.s).not.toBe(hash)
        }
      })

      it(`${name} at precision ${precision}: clamped latitude produces valid bounds`, () => {
        const hash = encode(lat, lon, precision)
        const dir = lat > 0 ? 'n' as const : 's' as const
        const extreme = neighbour(hash, dir)
        const b = bounds(extreme)

        // Bounds should be valid (min < max)
        expect(b.minLat).toBeLessThan(b.maxLat)
        expect(b.minLon).toBeLessThan(b.maxLon)

        // Latitude should stay within valid range
        expect(b.minLat).toBeGreaterThanOrEqual(-90)
        expect(b.maxLat).toBeLessThanOrEqual(90)
      })
    }
  }
})

describe('fuzz: antimeridian wrapping (both directions)', () => {
  const ANTIMERIDIAN_CASES = [
    { name: 'east wrapping (equator)', lat: 0, lon: 179.99 },
    { name: 'east wrapping (mid-lat)', lat: 45, lon: 179.95 },
    { name: 'west wrapping (equator)', lat: 0, lon: -179.99 },
    { name: 'west wrapping (mid-lat)', lat: -30, lon: -179.95 },
  ]

  for (const { name, lat, lon } of ANTIMERIDIAN_CASES) {
    for (let precision = 1; precision <= 7; precision++) {
      it(`${name} at precision ${precision}`, () => {
        const hash = encode(lat, lon, precision)
        const original = bounds(hash)

        if (lon > 0) {
          // Near +180: east neighbour should wrap to negative longitude
          const e = neighbour(hash, 'e')
          const eb = bounds(e)
          expect(e.length).toBe(precision)

          // Either adjacent normally or wrapped around the antimeridian
          expect(isLonAdjacent(eb.minLon, original.maxLon, 1e-6)).toBe(true)

          // If the cell actually touches the antimeridian, verify the wrap
          if (original.maxLon >= 180 - 1e-6) {
            expect(eb.maxLon).toBeLessThan(0)
          }
        } else {
          // Near -180: west neighbour should wrap to positive longitude
          const w = neighbour(hash, 'w')
          const wb = bounds(w)
          expect(w.length).toBe(precision)

          expect(isLonAdjacent(wb.maxLon, original.minLon, 1e-6)).toBe(true)

          // If the cell actually touches the antimeridian, verify the wrap
          if (original.minLon <= -180 + 1e-6) {
            expect(wb.minLon).toBeGreaterThan(0)
          }
        }
      })
    }
  }
})

describe('fuzz: diagonal neighbour bounds verification', () => {
  const DIAG_COORDS = [
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'equator', lat: 5, lon: 5 },
    { name: 'southern hemisphere', lat: -33.8688, lon: 151.2093 },
  ]

  for (const { name, lat, lon } of DIAG_COORDS) {
    for (let precision = 2; precision <= 7; precision++) {
      it(`${name} at precision ${precision}: diagonals share a corner`, () => {
        const hash = encode(lat, lon, precision)
        const orig = bounds(hash)
        const nbrs = neighbours(hash)
        const TOL = 1e-6

        // NE shares top-right corner: NE.minLat ≈ orig.maxLat, NE.minLon ≈ orig.maxLon
        const ne = bounds(nbrs.ne)
        expect(Math.abs(ne.minLat - orig.maxLat)).toBeLessThan(TOL)
        expect(isLonAdjacent(ne.minLon, orig.maxLon, TOL)).toBe(true)

        // SE shares bottom-right corner: SE.maxLat ≈ orig.minLat, SE.minLon ≈ orig.maxLon
        const se = bounds(nbrs.se)
        expect(Math.abs(se.maxLat - orig.minLat)).toBeLessThan(TOL)
        expect(isLonAdjacent(se.minLon, orig.maxLon, TOL)).toBe(true)

        // SW shares bottom-left corner: SW.maxLat ≈ orig.minLat, SW.maxLon ≈ orig.minLon
        const sw = bounds(nbrs.sw)
        expect(Math.abs(sw.maxLat - orig.minLat)).toBeLessThan(TOL)
        expect(isLonAdjacent(sw.maxLon, orig.minLon, TOL)).toBe(true)

        // NW shares top-left corner: NW.minLat ≈ orig.maxLat, NW.maxLon ≈ orig.minLon
        const nw = bounds(nbrs.nw)
        expect(Math.abs(nw.minLat - orig.maxLat)).toBeLessThan(TOL)
        expect(isLonAdjacent(nw.maxLon, orig.minLon, TOL)).toBe(true)
      })
    }
  }
})

describe('fuzz: high-precision sweep (precisions 7, 8, 9)', () => {
  // Grid: latitudes -60 to 60 (step 20), longitudes -170 to 170 (step 40)
  const lats = [-60, -40, -20, 0, 20, 40, 60]
  const lons = [-170, -130, -90, -50, -10, 30, 70, 110, 150, 170]

  for (const precision of [7, 8, 9]) {
    it(`precision ${precision}: adjacency holds across ${lats.length * lons.length} coordinates`, () => {
      const TOL = 1e-6

      for (const lat of lats) {
        for (const lon of lons) {
          const hash = encode(lat, lon, precision)
          const orig = bounds(hash)
          const nbrs = neighbours(hash)

          // All neighbours have correct precision
          for (const nb of Object.values(nbrs)) {
            expect(nb.length).toBe(precision)
          }

          // All 8 are distinct (no pole clamping at these latitudes)
          const nbValues = Object.values(nbrs)
          expect(new Set(nbValues).size).toBe(8)
          expect(nbValues).not.toContain(hash)

          // North/south adjacency
          const northB = bounds(nbrs.n)
          expect(Math.abs(northB.minLat - orig.maxLat)).toBeLessThan(TOL)
          const southB = bounds(nbrs.s)
          expect(Math.abs(southB.maxLat - orig.minLat)).toBeLessThan(TOL)

          // East/west adjacency (handles antimeridian)
          const eastB = bounds(nbrs.e)
          expect(isLonAdjacent(eastB.minLon, orig.maxLon, TOL)).toBe(true)
          const westB = bounds(nbrs.w)
          expect(isLonAdjacent(westB.maxLon, orig.minLon, TOL)).toBe(true)

          // Round-trip
          expect(neighbour(nbrs.n, 's')).toBe(hash)
          expect(neighbour(nbrs.s, 'n')).toBe(hash)
          expect(neighbour(nbrs.e, 'w')).toBe(hash)
          expect(neighbour(nbrs.w, 'e')).toBe(hash)
        }
      }
    })
  }
})

describe('fuzz: ring expansion gap detection', () => {
  const RING_COORDS = [
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'equator', lat: 5, lon: 5 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'southern hemisphere', lat: -33.8688, lon: 151.2093 },
  ]

  for (const { name, lat, lon } of RING_COORDS) {
    it(`${name} at precision 7: 2 rings produce a contiguous 5×5 grid`, () => {
      const hash = encode(lat, lon, 7)
      const rings = expandRings(hash, 2)
      const allCells = new Set(rings.flat())

      // 2 rings around a centre = 5×5 grid = 25 cells
      expect(allCells.size).toBe(25)

      // Ring 0 = 1 cell, Ring 1 = 8 cells, Ring 2 = 16 cells
      expect(rings[0]).toHaveLength(1)
      expect(rings[1]).toHaveLength(8)
      expect(rings[2]).toHaveLength(16)

      // Every cell's neighbours that are within 2 cells of the centre
      // should also be in the set — i.e. no internal gaps.
      // Verify by checking that ring-1 cells are all neighbours of centre.
      const centreNbrs = neighbours(hash)
      const ring1Set = new Set(rings[1])
      for (const nb of Object.values(centreNbrs)) {
        expect(ring1Set.has(nb)).toBe(true)
      }

      // All cells should have correct precision
      for (const cell of allCells) {
        expect(cell.length).toBe(7)
      }
    })
  }
})
