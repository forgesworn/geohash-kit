import { polygonToGeohashes, geohashesToGeoJSON, deduplicateGeohashes } from 'geohash-kit'

// Cover a rectangular area in central London
const polygon: [number, number][] = [
  [-0.15, 51.50],
  [-0.10, 51.50],
  [-0.10, 51.52],
  [-0.15, 51.52],
]

const hashes = polygonToGeohashes(polygon, { maxPrecision: 6, maxCells: 500 })
console.log('Coverage cells:', hashes.length)
console.log('Sample hashes:', hashes.slice(0, 5))

// Deduplicate (remove ancestors already covered by children)
const deduped = deduplicateGeohashes(hashes)
console.log('After dedup:', deduped.length)

// Convert to GeoJSON for map rendering
const geojson = geohashesToGeoJSON(hashes)
console.log('GeoJSON features:', geojson.features.length)
