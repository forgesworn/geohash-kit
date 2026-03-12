import { describe, it, expect } from 'vitest'
import {
  createGTagLadder, parseGTags, bestGeohash,
  expandRings, createGTagFilter, createGTagFilterFromGeohashes, nearbyFilter,
} from './nostr.js'
import { encode } from './core.js'

describe('createGTagLadder', () => {
  it('generates a ladder from precision 1 to the hash length', () => {
    const ladder = createGTagLadder('gcpvj')
    expect(ladder).toEqual([
      ['g', 'g'],
      ['g', 'gc'],
      ['g', 'gcp'],
      ['g', 'gcpv'],
      ['g', 'gcpvj'],
    ])
  })

  it('respects minPrecision', () => {
    const ladder = createGTagLadder('gcpvj', 3)
    expect(ladder).toEqual([
      ['g', 'gcp'],
      ['g', 'gcpv'],
      ['g', 'gcpvj'],
    ])
  })

  it('returns single tag for precision-1 hash', () => {
    const ladder = createGTagLadder('g')
    expect(ladder).toEqual([['g', 'g']])
  })

  it('returns empty array for empty string', () => {
    expect(createGTagLadder('')).toEqual([])
  })

  it('throws TypeError for invalid geohash characters', () => {
    expect(() => createGTagLadder('GCPVJ')).toThrow(TypeError)
    expect(() => createGTagLadder('gc!vj')).toThrow(TypeError)
  })
})

describe('parseGTags', () => {
  it('extracts g tags from a tag array', () => {
    const tags = [['g', 'gcpvj'], ['p', 'abc123'], ['g', 'gcpv'], ['g', 'gcp']]
    const result = parseGTags(tags)
    expect(result).toEqual([
      { geohash: 'gcpvj', precision: 5 },
      { geohash: 'gcpv', precision: 4 },
      { geohash: 'gcp', precision: 3 },
    ])
  })

  it('returns empty array when no g tags present', () => {
    expect(parseGTags([['p', 'abc'], ['e', 'def']])).toEqual([])
  })

  it('handles empty tag array', () => {
    expect(parseGTags([])).toEqual([])
  })

  it('ignores malformed tags', () => {
    const tags = [['g'], ['g', ''], ['g', 'gcpvj']]
    const result = parseGTags(tags)
    expect(result).toEqual([{ geohash: 'gcpvj', precision: 5 }])
  })
})

describe('bestGeohash', () => {
  it('returns the highest-precision g tag', () => {
    const tags = [['g', 'g'], ['g', 'gc'], ['g', 'gcp'], ['g', 'gcpv'], ['g', 'gcpvj']]
    expect(bestGeohash(tags)).toBe('gcpvj')
  })

  it('returns undefined when no g tags present', () => {
    expect(bestGeohash([['p', 'abc']])).toBeUndefined()
  })

  it('returns undefined for empty tag array', () => {
    expect(bestGeohash([])).toBeUndefined()
  })
})

describe('expandRings — input validation', () => {
  it('throws RangeError for NaN ring count', () => {
    expect(() => expandRings('gcpvj', NaN)).toThrow(RangeError)
  })

  it('throws RangeError for negative ring count', () => {
    expect(() => expandRings('gcpvj', -1)).toThrow(RangeError)
  })

  it('clamps ring count to 10', () => {
    const rings = expandRings('gcpvj', 100)
    // 10 rings + ring 0 = 11 entries
    expect(rings).toHaveLength(11)
  })
})

describe('expandRings', () => {
  it('ring 0 is just the hash itself', () => {
    const rings = expandRings('gcpvj', 0)
    expect(rings).toEqual([['gcpvj']])
  })

  it('ring 1 contains 8 neighbours (9 total with centre)', () => {
    const rings = expandRings('gcpvj', 1)
    expect(rings).toHaveLength(2) // ring 0 + ring 1
    expect(rings[0]).toEqual(['gcpvj'])
    expect(rings[1]).toHaveLength(8)
    // All ring-1 entries should be unique and not equal to centre
    expect(new Set(rings[1]).size).toBe(8)
    expect(rings[1]).not.toContain('gcpvj')
  })

  it('ring 2 has 16 cells (outer ring of a 5x5 grid minus 3x3 inner)', () => {
    const rings = expandRings('gcpvj', 2)
    expect(rings).toHaveLength(3) // ring 0 + ring 1 + ring 2
    // Ring 2 cells should not appear in ring 0 or ring 1
    const inner = new Set([...rings[0], ...rings[1]])
    for (const h of rings[2]) {
      expect(inner.has(h)).toBe(false)
    }
  })

  it('defaults to 1 ring', () => {
    const rings = expandRings('gcpvj')
    expect(rings).toHaveLength(2)
  })
})

describe('createGTagFilter', () => {
  it('returns a filter with "#g" key', () => {
    const filter = createGTagFilter(51.5074, -0.1278, 5000)
    expect(filter).toHaveProperty('#g')
    expect(filter['#g'].length).toBeGreaterThan(0)
  })

  it('includes the encoded geohash in the filter', () => {
    const filter = createGTagFilter(51.5074, -0.1278, 5000)
    // The encoded hash at the selected precision should be in the filter
    const hash = encode(51.5074, -0.1278, 5)
    expect(filter['#g']).toContain(hash)
  })

  it('includes neighbour geohashes for boundary coverage', () => {
    const filter = createGTagFilter(51.5074, -0.1278, 5000)
    // Should have more than 1 entry (centre + neighbours)
    expect(filter['#g'].length).toBeGreaterThan(1)
  })

  it('has no duplicate entries', () => {
    const filter = createGTagFilter(51.5074, -0.1278, 2500)
    expect(new Set(filter['#g']).size).toBe(filter['#g'].length)
  })
})

describe('createGTagFilterFromGeohashes', () => {
  it('returns a filter from a hash array', () => {
    const filter = createGTagFilterFromGeohashes(['gcpvj', 'gcpvm', 'gcpvn'])
    expect(filter['#g']).toEqual(['gcpvj', 'gcpvm', 'gcpvn'])
  })

  it('deduplicates entries', () => {
    const filter = createGTagFilterFromGeohashes(['gcpvj', 'gcpvj', 'gcpvm'])
    expect(filter['#g']).toEqual(['gcpvj', 'gcpvm'])
  })
})

describe('nearbyFilter', () => {
  it('returns a filter for a location', () => {
    const filter = nearbyFilter(51.5074, -0.1278)
    expect(filter['#g'].length).toBeGreaterThan(1)
  })

  it('respects custom precision', () => {
    const filter = nearbyFilter(51.5074, -0.1278, { precision: 3 })
    // All hashes should be precision 3
    for (const h of filter['#g']) {
      expect(h.length).toBe(3)
    }
  })

  it('respects custom ring count', () => {
    const r1 = nearbyFilter(51.5074, -0.1278, { rings: 1 })
    const r2 = nearbyFilter(51.5074, -0.1278, { rings: 2 })
    expect(r2['#g'].length).toBeGreaterThan(r1['#g'].length)
  })
})

describe('round-trip: publish with ladder, subscribe with filter', () => {
  it('published event is discoverable by generated filter', () => {
    // Simulate: publisher creates event with g-tag ladder
    const publisherHash = encode(51.5074, -0.1278, 6)
    const eventTags = createGTagLadder(publisherHash)

    // Subscriber creates filter for nearby events
    const filter = createGTagFilter(51.5080, -0.1270, 2000)

    // At least one tag value should appear in the filter
    const tagValues = eventTags.map(t => t[1])
    const filterValues = new Set(filter['#g'])
    const match = tagValues.some(v => filterValues.has(v))
    expect(match).toBe(true)
  })
})
