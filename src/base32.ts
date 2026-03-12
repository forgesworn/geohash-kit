// geohash-kit/base32 — shared base32 constants and validation

export const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export const BASE32_DECODE: Record<string, number> = Object.create(null) as Record<string, number>
for (let i = 0; i < BASE32.length; i++) BASE32_DECODE[BASE32[i]] = i

/** Throw TypeError if any character is not a valid base32 geohash character. */
export function validateGeohash(hash: string): void {
  for (const ch of hash) {
    if (!(ch in BASE32_DECODE)) {
      throw new TypeError(`Invalid geohash character: '${ch}' in "${hash}"`)
    }
  }
}

/** Return true if the string is a non-empty valid base32 geohash. */
export function isValidGeohash(hash: string): boolean {
  if (hash.length === 0) return false
  for (const ch of hash) {
    if (!(ch in BASE32_DECODE)) return false
  }
  return true
}
