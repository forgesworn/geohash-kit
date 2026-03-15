import { encode } from 'geohash-kit/core'
import { createGTagLadder, createGTagFilter, parseGTags, bestGeohash } from 'geohash-kit/nostr'

// --- Publishing: tag an event with a g-tag ladder ---

const hash = encode(51.5074, -0.1278, 6)
const tags = createGTagLadder(hash)
console.log('G-tag ladder:', tags)
// [['g','g'], ['g','gc'], ['g','gcp'], ['g','gcpv'], ['g','gcpvj'], ['g','gcpvjb']]

// --- Subscribing: build a REQ filter for nearby events ---

const filter = createGTagFilter(51.5074, -0.1278, 5000)
console.log('REQ filter:', filter)
// { '#g': ['gcpvj', 'gcpvm', ...] }

// --- Parsing: extract geohash from received event tags ---

const eventTags = [['g', 'gcpvjb'], ['g', 'gcpvj'], ['p', 'abc123']]
const best = bestGeohash(eventTags)
console.log('Best geohash:', best) // 'gcpvjb'

const all = parseGTags(eventTags)
console.log('All g-tags:', all)
