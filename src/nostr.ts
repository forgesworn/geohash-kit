// geohash-kit/nostr — Nostr g-tag utilities

import { encode, neighbours, radiusToPrecision } from './core.js'
import { isValidGeohash, validateGeohash } from './base32.js'

// --- Publishing (event tags) ---

/** Generate multi-precision g-tag ladder for Nostr event publishing. */
export function createGTagLadder(geohash: string, minPrecision = 1): string[][] {
  if (geohash.length > 0) validateGeohash(geohash)
  const tags: string[][] = []
  for (let p = Math.max(1, minPrecision); p <= geohash.length; p++) {
    tags.push(['g', geohash.slice(0, p)])
  }
  return tags
}

// --- Parsing ---

/**
 * Extract and parse g tags from a Nostr event's tag array.
 * Invalid geohashes (containing non-base32 characters) are silently filtered out,
 * since relay data is untrusted. Empty strings are also excluded.
 */
export function parseGTags(tags: string[][]): Array<{ geohash: string; precision: number }> {
  return tags
    .filter((t) => t[0] === 'g' && t[1] && isValidGeohash(t[1]))
    .map((t) => ({ geohash: t[1], precision: t[1].length }))
}

/** Return the highest-precision g tag from an event's tag array. */
export function bestGeohash(tags: string[][]): string | undefined {
  const parsed = parseGTags(tags)
  if (parsed.length === 0) return undefined
  return parsed.reduce((best, curr) => curr.precision > best.precision ? curr : best).geohash
}

// --- Ring expansion ---

/** Expand geohash into concentric rings of neighbours. Max 10 rings. */
export function expandRings(hash: string, rings = 1): string[][] {
  if (!Number.isFinite(rings) || rings < 0) throw new RangeError(`Invalid ring count: ${rings}`)
  const clampedRings = Math.min(10, Math.round(rings))
  const result: string[][] = [[hash]]
  const seen = new Set([hash])

  for (let ring = 1; ring <= clampedRings; ring++) {
    const prevRing = result[ring - 1]
    const candidates = new Set<string>()
    for (const cell of prevRing) {
      const n = neighbours(cell)
      for (const adj of Object.values(n)) {
        if (!seen.has(adj)) {
          candidates.add(adj)
        }
      }
    }
    const ringCells = Array.from(candidates)
    for (const c of ringCells) seen.add(c)
    result.push(ringCells)
  }

  return result
}

// --- Filter generation (subscribing) ---

/** Generate a #g filter for Nostr REQ from coordinates and radius. */
export function createGTagFilter(
  lat: number,
  lon: number,
  radiusMetres: number,
): { '#g': string[] } {
  const precision = radiusToPrecision(radiusMetres)
  const hash = encode(lat, lon, precision)

  // Expand one ring to cover cell boundaries
  const rings = expandRings(hash, 1)
  const allHashes = rings.flat()

  return { '#g': [...new Set(allHashes)] }
}

/** Generate a #g filter from an existing geohash set. */
export function createGTagFilterFromGeohashes(hashes: string[]): { '#g': string[] } {
  return { '#g': [...new Set(hashes)] }
}

/** Convenience: encode + expand rings + flatten to filter. */
export function nearbyFilter(
  lat: number,
  lon: number,
  options?: { precision?: number; rings?: number },
): { '#g': string[] } {
  const precision = options?.precision ?? 5
  const ringCount = options?.rings ?? 1
  const hash = encode(lat, lon, precision)
  const rings = expandRings(hash, ringCount)
  const allHashes = rings.flat()
  return { '#g': [...new Set(allHashes)] }
}
