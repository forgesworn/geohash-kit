// --- Local import of geohash-kit ---
import {
  encode, decode, bounds, neighbours, children, contains, matchesAny,
  distance, distanceFromCoords, radiusToPrecision, precisionToRadius,
  polygonToGeohashes, geohashesToGeoJSON, geohashesToConvexHull,
  deduplicateGeohashes, pointInPolygon,
  createGTagLadder, createGTagFilter, createGTagFilterFromGeohashes,
  expandRings, nearbyFilter, parseGTags, bestGeohash,
} from './lib/index.js'

// --- Map setup ---
const map = L.map('map').setView([51.5074, -0.1278], 12)

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  maxZoom: 20,
  subdomains: 'abcd',
}).addTo(map)

// --- Layer groups (one per tab, swapped on tab switch) ---
const layers = {
  explore: L.layerGroup().addTo(map),
  cover: L.layerGroup().addTo(map),
  nostr: L.layerGroup().addTo(map),
}

// --- State ---
let activeTab = 'explore'
let exploreMode = 'encode'  // 'encode' | 'distance' | 'children'
let exploreLatLng = null
let distancePointA = null
let distancePointB = null
let coverPolygon = null
let coverVertices = []
let coverDrawing = false
let coverPolyline = null
let coverHashes = null
let showHull = false
let showGeoJSON = false

// --- Tab switching ---
const tabs = document.querySelectorAll('.tab')
const panels = document.querySelectorAll('.panel-content')

function switchTab(tab) {
  activeTab = tab

  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab))
  panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab))

  // Show/hide layers
  Object.entries(layers).forEach(([key, layer]) => {
    if (key === tab) map.addLayer(layer)
    else map.removeLayer(layer)
  })

  // Reset drawing state when leaving cover tab
  if (tab !== 'cover' && coverDrawing) {
    cancelDrawing()
  }

  // Start drawing mode when entering cover tab (if no polygon yet)
  if (tab === 'cover' && !coverPolygon) {
    startDrawing()
  }
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)))

// Initial state
switchTab('explore')

// --- Map click handler (delegates to active tab) ---
map.on('click', (e) => {
  if (activeTab === 'explore') onExploreClick(e.latlng)
  else if (activeTab === 'cover') onCoverClick(e.latlng)
  else if (activeTab === 'nostr') onNostrClick(e.latlng)
})

// --- Precision colour scale (neon/cyberpunk) ---
const PRECISION_COLOURS = [
  '', // 0 (unused)
  '#ff00ff', // 1 — magenta
  '#d946ef', // 2
  '#a855f7', // 3 — purple
  '#6366f1', // 4
  '#3b82f6', // 5 — blue
  '#06b6d4', // 6 — cyan
  '#10b981', // 7
  '#22c55e', // 8 — green
  '#84cc16', // 9 — lime
]

function hashColour(hash) {
  return PRECISION_COLOURS[hash.length] || PRECISION_COLOURS[5]
}

// --- Helper: draw a geohash cell on a layer ---
function drawCell(layer, hash, opts = {}) {
  const b = bounds(hash)
  const rect = L.rectangle(
    [[b.minLat, b.minLon], [b.maxLat, b.maxLon]],
    {
      color: opts.color || hashColour(hash),
      fillColor: opts.fillColor || opts.color || hashColour(hash),
      fillOpacity: opts.fillOpacity ?? 0.25,
      weight: opts.weight ?? 1,
    }
  )
  rect.addTo(layer)
  return rect
}

// --- Helper: format code snippet ---
function codeSnippet(lines) {
  return lines
    .map(l => l
      .replace(/('.*?')/g, '<span class="str">$1</span>')
      .replace(/(\d+\.?\d*)/g, '<span class="num">$1</span>')
      .replace(/\b(import|from|const)\b/g, '<span class="kw">$1</span>')
    )
    .join('\n')
}

// --- Helper: format distance ---
function formatDistance(metres) {
  if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`
  return `${metres.toFixed(1)} m`
}

// =====================================================
//  EXPLORE TAB — mode switcher
// =====================================================

const exploreModeEncode = document.getElementById('explore-mode-encode')
const exploreModeDistance = document.getElementById('explore-mode-distance')
const exploreModeChildren = document.getElementById('explore-mode-children')
const exploreHint = document.querySelector('[data-panel="explore"] .hint')

function setExploreMode(mode) {
  exploreMode = mode
  layers.explore.clearLayers()

  // Toggle active button
  exploreModeEncode.classList.toggle('active', mode === 'encode')
  exploreModeDistance.classList.toggle('active', mode === 'distance')
  exploreModeChildren.classList.toggle('active', mode === 'children')

  // Toggle panels
  document.getElementById('explore-info').classList.add('hidden')
  document.getElementById('explore-distance-info').classList.add('hidden')
  document.getElementById('explore-children-info').classList.add('hidden')

  // Update hint
  if (mode === 'encode') exploreHint.textContent = 'Click anywhere on the map to encode a geohash.'
  else if (mode === 'distance') {
    exploreHint.textContent = 'Click two points on the map to measure distance.'
    distancePointA = null
    distancePointB = null
  }
  else if (mode === 'children') exploreHint.textContent = 'Click anywhere to see the 32 child cells.'
}

exploreModeEncode.addEventListener('click', () => setExploreMode('encode'))
exploreModeDistance.addEventListener('click', () => setExploreMode('distance'))
exploreModeChildren.addEventListener('click', () => setExploreMode('children'))

function onExploreClick(latlng) {
  if (exploreMode === 'encode') {
    exploreLatLng = latlng
    renderExplore()
  } else if (exploreMode === 'distance') {
    onDistanceClick(latlng)
  } else if (exploreMode === 'children') {
    exploreLatLng = latlng
    renderChildren()
  }
}

// --- Encode mode ---

document.getElementById('explore-precision').addEventListener('change', () => {
  if (exploreLatLng && exploreMode === 'encode') renderExplore()
  if (exploreLatLng && exploreMode === 'children') renderChildren()
})

function renderExplore() {
  const { lat, lng: lon } = exploreLatLng
  const precision = parseInt(document.getElementById('explore-precision').value)

  const hash = encode(lat, lon, precision)
  const decoded = decode(hash)
  const adj = neighbours(hash)
  const cellRadius = precisionToRadius(precision)

  // Update panel
  document.getElementById('explore-info').classList.remove('hidden')
  document.getElementById('explore-hash').textContent = hash
  document.getElementById('explore-decoded').textContent =
    `${decoded.lat.toFixed(6)}, ${decoded.lon.toFixed(6)}`
  document.getElementById('explore-error').textContent =
    `\u00b1${decoded.error.lat.toFixed(6)}\u00b0 lat, \u00b1${decoded.error.lon.toFixed(6)}\u00b0 lon`
  document.getElementById('explore-radius').textContent = formatDistance(cellRadius)

  document.getElementById('explore-code').innerHTML = codeSnippet([
    `import { encode, decode, neighbours, precisionToRadius } from 'geohash-kit'`,
    ``,
    `const hash = encode(${lat.toFixed(4)}, ${lon.toFixed(4)}, ${precision})`,
    `// '${hash}'`,
    ``,
    `const decoded = decode('${hash}')`,
    `// { lat: ${decoded.lat.toFixed(6)}, lon: ${decoded.lon.toFixed(6)} }`,
    ``,
    `const adj = neighbours('${hash}')`,
    `// { n: '${adj.n}', ne: '${adj.ne}', e: '${adj.e}', ... }`,
    ``,
    `const radius = precisionToRadius(${precision})`,
    `// ${cellRadius} metres`,
  ])

  // Draw cells
  layers.explore.clearLayers()
  drawCell(layers.explore, hash, { fillOpacity: 0.35, weight: 2 })
  Object.values(adj).forEach(h =>
    drawCell(layers.explore, h, { fillOpacity: 0.12, weight: 1 })
  )
}

// --- Distance mode ---

function onDistanceClick(latlng) {
  if (!distancePointA) {
    distancePointA = latlng
    distancePointB = null
    layers.explore.clearLayers()
    L.circleMarker(latlng, { radius: 8, color: '#ff00ff', fillColor: '#ff00ff', fillOpacity: 0.8 }).addTo(layers.explore)
    exploreHint.textContent = 'Now click a second point.'
    document.getElementById('explore-distance-info').classList.add('hidden')
  } else {
    distancePointB = latlng
    L.circleMarker(latlng, { radius: 8, color: '#84cc16', fillColor: '#84cc16', fillOpacity: 0.8 }).addTo(layers.explore)
    L.polyline([distancePointA, distancePointB], { color: '#4fc3f7', weight: 2, dashArray: '6, 8' }).addTo(layers.explore)
    renderDistance()
    exploreHint.textContent = 'Click two points on the map to measure distance.'
    distancePointA = null
    distancePointB = null
  }
}

function renderDistance() {
  const precision = parseInt(document.getElementById('explore-precision').value)
  const hashA = encode(distancePointA.lat, distancePointA.lng, precision)
  const hashB = encode(distancePointB.lat, distancePointB.lng, precision)
  const dist = distance(hashA, hashB)
  const coordDist = distanceFromCoords(distancePointA.lat, distancePointA.lng, distancePointB.lat, distancePointB.lng)
  const cont = contains(hashA, hashB)
  const match = matchesAny(hashA, [hashB])

  drawCell(layers.explore, hashA, { color: '#ff00ff', fillOpacity: 0.2, weight: 2 })
  drawCell(layers.explore, hashB, { color: '#84cc16', fillOpacity: 0.2, weight: 2 })

  document.getElementById('explore-distance-info').classList.remove('hidden')
  document.getElementById('distance-hash-a').textContent = hashA
  document.getElementById('distance-hash-b').textContent = hashB
  document.getElementById('distance-result').textContent =
    `${formatDistance(dist)} (cell centres) · ${formatDistance(coordDist)} (exact)`
  document.getElementById('distance-contains').textContent =
    `contains: ${cont} · matchesAny: ${match}`

  document.getElementById('distance-code').innerHTML = codeSnippet([
    `import { distance, distanceFromCoords, contains, matchesAny } from 'geohash-kit'`,
    ``,
    `distance('${hashA}', '${hashB}')`,
    `// ${formatDistance(dist)}`,
    ``,
    `distanceFromCoords(${distancePointA.lat.toFixed(4)}, ${distancePointA.lng.toFixed(4)}, ${distancePointB.lat.toFixed(4)}, ${distancePointB.lng.toFixed(4)})`,
    `// ${formatDistance(coordDist)}`,
    ``,
    `contains('${hashA}', '${hashB}') // ${cont}`,
    `matchesAny('${hashA}', ['${hashB}']) // ${match}`,
  ])
}

// --- Children mode ---

function renderChildren() {
  const { lat, lng: lon } = exploreLatLng
  const precision = parseInt(document.getElementById('explore-precision').value)
  const hash = encode(lat, lon, precision)
  const kids = children(hash)

  layers.explore.clearLayers()

  // Draw parent cell outline
  drawCell(layers.explore, hash, { fillOpacity: 0.05, weight: 2, color: '#4fc3f7' })

  // Draw all 32 children
  kids.forEach(k => drawCell(layers.explore, k, { fillOpacity: 0.3, weight: 1 }))

  document.getElementById('explore-children-info').classList.remove('hidden')
  document.getElementById('children-parent').textContent = `${hash} (precision ${precision})`
  document.getElementById('children-list').textContent = kids.join(', ')

  document.getElementById('children-code').innerHTML = codeSnippet([
    `import { children } from 'geohash-kit'`,
    ``,
    `const kids = children('${hash}')`,
    `// 32 children at precision ${precision + 1}`,
    `// ['${kids[0]}', '${kids[1]}', '${kids[2]}', ...]`,
  ])
}

// =====================================================
//  COVER TAB — click-to-draw polygon
// =====================================================

const coverMaxCells = document.getElementById('cover-max-cells')
const coverMaxCellsValue = document.getElementById('cover-max-cells-value')
const coverMerge = document.getElementById('cover-merge')
const coverMergeValue = document.getElementById('cover-merge-value')
const coverClear = document.getElementById('cover-clear')
const coverFinish = document.getElementById('cover-finish')
const coverDrawingEl = document.getElementById('cover-drawing')
const coverVertexCount = document.getElementById('cover-vertex-count')
const coverToggleHull = document.getElementById('cover-toggle-hull')
const coverToggleGeoJSON = document.getElementById('cover-toggle-geojson')

coverMaxCells.addEventListener('input', () => {
  coverMaxCellsValue.textContent = coverMaxCells.value
  if (coverPolygon) renderCover()
})

coverMerge.addEventListener('input', () => {
  coverMergeValue.textContent = coverMerge.value
  if (coverPolygon) renderCover()
})

coverClear.addEventListener('click', () => {
  coverPolygon = null
  coverVertices = []
  coverHashes = null
  showHull = false
  showGeoJSON = false
  coverToggleHull.classList.remove('toggled')
  coverToggleGeoJSON.classList.remove('toggled')
  document.getElementById('cover-geojson-wrap').classList.add('hidden')
  layers.cover.clearLayers()
  document.getElementById('cover-info').classList.add('hidden')
  startDrawing()
})

coverFinish.addEventListener('click', () => finishPolygon())

coverToggleHull.addEventListener('click', () => {
  showHull = !showHull
  coverToggleHull.classList.toggle('toggled', showHull)
  if (coverHashes) renderCoverLayers()
})

coverToggleGeoJSON.addEventListener('click', () => {
  showGeoJSON = !showGeoJSON
  coverToggleGeoJSON.classList.toggle('toggled', showGeoJSON)
  document.getElementById('cover-geojson-wrap').classList.toggle('hidden', !showGeoJSON)
  if (showGeoJSON && coverHashes) {
    const geojson = geohashesToGeoJSON(coverHashes)
    document.getElementById('cover-geojson').textContent = JSON.stringify(geojson, null, 2)
  }
})

function startDrawing() {
  coverDrawing = true
  coverVertices = []
  coverDrawingEl.classList.remove('hidden')
  coverVertexCount.textContent = '0 vertices'
  if (coverPolyline) {
    layers.cover.removeLayer(coverPolyline)
    coverPolyline = null
  }
}

function cancelDrawing() {
  coverDrawing = false
  coverVertices = []
  coverDrawingEl.classList.add('hidden')
  if (coverPolyline) {
    layers.cover.removeLayer(coverPolyline)
    coverPolyline = null
  }
  layers.cover.clearLayers()
}

function onCoverClick(latlng) {
  if (!coverDrawing) return

  // Check if clicking near the first vertex to close the polygon
  if (coverVertices.length >= 3) {
    const first = coverVertices[0]
    const dist = map.latLngToContainerPoint(latlng).distanceTo(
      map.latLngToContainerPoint(first)
    )
    if (dist < 15) {
      finishPolygon()
      return
    }
  }

  coverVertices.push(latlng)

  // Draw vertex marker
  L.circleMarker(latlng, {
    radius: 6,
    color: '#4fc3f7',
    fillColor: '#4fc3f7',
    fillOpacity: 0.8,
    weight: 2,
  }).addTo(layers.cover)

  // Update preview polyline
  if (coverPolyline) layers.cover.removeLayer(coverPolyline)
  if (coverVertices.length > 1) {
    coverPolyline = L.polyline(coverVertices, {
      color: '#4fc3f7',
      weight: 2,
      dashArray: '6, 8',
    }).addTo(layers.cover)
  }

  // Update vertex count
  const n = coverVertices.length
  coverVertexCount.textContent = `${n} ${n === 1 ? 'vertex' : 'vertices'}`
}

function finishPolygon() {
  if (coverVertices.length < 3) return

  coverDrawing = false
  coverDrawingEl.classList.add('hidden')

  // Convert to [lon, lat] pairs and close the ring
  coverPolygon = coverVertices.map(ll => [ll.lng, ll.lat])
  coverPolygon.push([...coverPolygon[0]])

  layers.cover.clearLayers()
  coverPolyline = null

  // Draw the polygon outline
  L.polygon(coverVertices, {
    color: '#4fc3f7',
    fillColor: '#4fc3f7',
    fillOpacity: 0.05,
    weight: 2,
  }).addTo(layers.cover)

  renderCover()
}

function renderCover() {
  const maxCells = parseInt(coverMaxCells.value)
  const mergeThreshold = parseFloat(coverMerge.value)

  try {
    coverHashes = polygonToGeohashes(coverPolygon, { maxCells, mergeThreshold })
  } catch (err) {
    document.getElementById('cover-info').classList.remove('hidden')
    document.getElementById('cover-count').textContent = `Error: ${err.message}`
    document.getElementById('cover-range').textContent = '\u2014'
    document.getElementById('cover-dedup').textContent = '\u2014'
    document.getElementById('cover-code').innerHTML = ''
    return
  }

  // Dedup stats
  const deduped = deduplicateGeohashes(coverHashes)
  const dedupLossy = deduplicateGeohashes(coverHashes, { lossy: true })

  // Precision range
  const precisions = coverHashes.map(h => h.length)
  const minP = Math.min(...precisions)
  const maxP = Math.max(...precisions)

  // Update panel
  document.getElementById('cover-info').classList.remove('hidden')
  document.getElementById('cover-count').textContent = `${coverHashes.length} cells`
  document.getElementById('cover-dedup').textContent =
    `${deduped.length} exact · ${dedupLossy.length} lossy`
  document.getElementById('cover-range').textContent = minP === maxP ? `${minP}` : `${minP}\u2013${maxP}`

  const polyStr = coverPolygon.slice(0, 3).map(p => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`).join(', ')
  document.getElementById('cover-code').innerHTML = codeSnippet([
    `import { polygonToGeohashes, deduplicateGeohashes,`,
    `         geohashesToGeoJSON, geohashesToConvexHull } from 'geohash-kit'`,
    ``,
    `const hashes = polygonToGeohashes(`,
    `  [${polyStr}, ...],`,
    `  { maxCells: ${maxCells}, mergeThreshold: ${mergeThreshold} }`,
    `)`,
    `// ${coverHashes.length} cells (precision ${minP === maxP ? minP : minP + '\u2013' + maxP})`,
    ``,
    `deduplicateGeohashes(hashes) // ${deduped.length} cells`,
    `deduplicateGeohashes(hashes, { lossy: true }) // ${dedupLossy.length} cells`,
    ``,
    `geohashesToGeoJSON(hashes) // GeoJSON FeatureCollection`,
    `geohashesToConvexHull(hashes) // [[lon, lat], ...]`,
  ])

  // Update GeoJSON panel if visible
  if (showGeoJSON) {
    const geojson = geohashesToGeoJSON(coverHashes)
    document.getElementById('cover-geojson').textContent = JSON.stringify(geojson, null, 2)
  }

  renderCoverLayers()
}

function renderCoverLayers() {
  // Keep the polygon outline, redraw everything else
  const polygonOutlines = []
  layers.cover.eachLayer(l => {
    if (l instanceof L.Polygon && !(l instanceof L.Rectangle)) polygonOutlines.push(l)
  })
  layers.cover.clearLayers()
  polygonOutlines.forEach(l => layers.cover.addLayer(l))

  // Draw coverage cells
  if (coverHashes) {
    coverHashes.forEach(h => drawCell(layers.cover, h))
  }

  // Draw convex hull if toggled
  if (showHull && coverHashes) {
    const hull = geohashesToConvexHull(coverHashes)
    if (hull.length >= 3) {
      const hullLatLngs = hull.map(p => [p[1], p[0]]) // [lon, lat] → [lat, lon]
      L.polygon(hullLatLngs, {
        color: '#ff00ff',
        fillColor: '#ff00ff',
        fillOpacity: 0.08,
        weight: 3,
        dashArray: '8, 6',
      }).addTo(layers.cover)
    }
  }
}

// =====================================================
//  NOSTR TAB
// =====================================================

const nostrRings = document.getElementById('nostr-rings')
const nostrRingsValue = document.getElementById('nostr-rings-value')
const nostrRadius = document.getElementById('nostr-radius')
let nostrLatLng = null

nostrRings.addEventListener('input', () => {
  nostrRingsValue.textContent = nostrRings.value
  if (nostrLatLng) renderNostr()
})

nostrRadius.addEventListener('change', () => {
  if (nostrLatLng) renderNostr()
})

function onNostrClick(latlng) {
  nostrLatLng = latlng
  renderNostr()
}

// Ring colour bands (centre → outer)
const RING_COLOURS = ['#3b82f6', '#06b6d4', '#22c55e', '#ff00ff']

function renderNostr() {
  const { lat, lng: lon } = nostrLatLng
  const radius = parseInt(nostrRadius.value)
  const ringCount = parseInt(nostrRings.value)

  const hash = encode(lat, lon)
  const ladder = createGTagLadder(hash)
  const filter = createGTagFilter(lat, lon, radius)
  const nearby = nearbyFilter(lat, lon, { precision: hash.length, rings: ringCount })
  const rings = expandRings(hash, ringCount)

  // Mock event tags for parseGTags/bestGeohash demo
  const mockTags = ladder.map(t => ['g', t[1]])
  const parsed = parseGTags(mockTags)
  const best = bestGeohash(mockTags)

  // Update panel
  document.getElementById('nostr-info').classList.remove('hidden')

  document.getElementById('nostr-ladder').innerHTML =
    ladder.map(t => `["g", "${t[1]}"]`).join('\n')

  document.getElementById('nostr-filter').innerHTML =
    JSON.stringify(filter, null, 2)

  document.getElementById('nostr-nearby').innerHTML =
    JSON.stringify(nearby, null, 2)

  document.getElementById('nostr-parse').innerHTML = [
    `parseGTags(tags) → ${parsed.length} tags found`,
    `bestGeohash(tags) → "${best}"`,
  ].join('\n')

  document.getElementById('nostr-code').innerHTML = codeSnippet([
    `import { createGTagLadder, createGTagFilter, nearbyFilter,`,
    `         expandRings, parseGTags, bestGeohash } from 'geohash-kit'`,
    ``,
    `const ladder = createGTagLadder('${hash}')`,
    `// ${ladder.length} tags from precision 1 to ${hash.length}`,
    ``,
    `const filter = createGTagFilter(${lat.toFixed(4)}, ${lon.toFixed(4)}, ${radius})`,
    `// { '#g': [${filter['#g'].slice(0, 3).map(h => `'${h}'`).join(', ')}, ...] }`,
    ``,
    `const nearby = nearbyFilter(${lat.toFixed(4)}, ${lon.toFixed(4)}, { precision: ${hash.length}, rings: ${ringCount} })`,
    `// { '#g': [...] } — ${nearby['#g'].length} hashes`,
    ``,
    `const best = bestGeohash(event.tags) // '${best}'`,
    `const all = parseGTags(event.tags) // ${parsed.length} tags`,
  ])

  // Draw rings
  layers.nostr.clearLayers()
  rings.forEach((ring, i) => {
    const colour = RING_COLOURS[i] || RING_COLOURS[RING_COLOURS.length - 1]
    ring.forEach(h => drawCell(layers.nostr, h, {
      color: colour,
      fillColor: colour,
      fillOpacity: i === 0 ? 0.35 : 0.15,
      weight: i === 0 ? 2 : 1,
    }))
  })
}
