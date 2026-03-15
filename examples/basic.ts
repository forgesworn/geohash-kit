import { encode, decode, neighbours, distance } from 'geohash-kit'

// Encode a location (London)
const hash = encode(51.5074, -0.1278)
console.log('Geohash:', hash) // 'gcpvj'

// Decode back to coordinates
const { lat, lon, error } = decode(hash)
console.log('Decoded:', { lat, lon, error })

// Get all 8 adjacent cells
const adj = neighbours(hash)
console.log('Neighbours:', adj)

// Distance between London and Paris
const d = distance('gcpvj', 'u09tu')
console.log('London → Paris:', Math.round(d / 1000), 'km')
