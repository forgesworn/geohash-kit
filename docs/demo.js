// --- Local import of geohash-kit ---
import {
  encode, decode, bounds, neighbours,
  polygonToGeohashes, geohashesToGeoJSON,
  createGTagLadder, createGTagFilter, expandRings,
} from './lib/index.js'

// --- Map setup ---
const map = L.map('map').setView([51.5074, -0.1278], 12)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map)

// --- Layer groups (one per tab, swapped on tab switch) ---
const layers = {
  explore: L.layerGroup().addTo(map),
  cover: L.layerGroup().addTo(map),
  nostr: L.layerGroup().addTo(map),
}

// --- Leaflet.draw (for Cover tab) ---
const drawnItems = new L.FeatureGroup()
map.addLayer(drawnItems)

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false,
  },
  edit: { featureGroup: drawnItems },
})

// --- State ---
let activeTab = 'explore'
let exploreLatLng = null
let coverPolygon = null

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

  // Show/hide draw control
  if (tab === 'cover') {
    map.addControl(drawControl)
    map.addLayer(drawnItems)
  } else {
    map.removeControl(drawControl)
    map.removeLayer(drawnItems)
  }
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)))

// Initial state — show explore layers, hide others
switchTab('explore')

// --- Map click handler (delegates to active tab) ---
map.on('click', (e) => {
  if (activeTab === 'explore') onExploreClick(e.latlng)
  else if (activeTab === 'nostr') onNostrClick(e.latlng)
})

// --- Precision colour scale ---
const PRECISION_COLOURS = [
  '', // 0 (unused)
  '#1565c0', // 1 — deep blue
  '#1976d2', // 2
  '#1e88e5', // 3
  '#42a5f5', // 4
  '#66bb6a', // 5 — green
  '#fdd835', // 6 — yellow
  '#ffa726', // 7 — orange
  '#ef5350', // 8 — red
  '#ad1457', // 9 — deep pink
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

// =====================================================
//  EXPLORE TAB
// =====================================================

function onExploreClick(latlng) {
  exploreLatLng = latlng
  renderExplore()
}

document.getElementById('explore-precision').addEventListener('change', () => {
  if (exploreLatLng) renderExplore()
})

function renderExplore() {
  const { lat, lng: lon } = exploreLatLng
  const precision = parseInt(document.getElementById('explore-precision').value)

  const hash = encode(lat, lon, precision)
  const decoded = decode(hash)
  const adj = neighbours(hash)

  // Update panel
  document.getElementById('explore-info').classList.remove('hidden')
  document.getElementById('explore-hash').textContent = hash
  document.getElementById('explore-decoded').textContent =
    `${decoded.lat.toFixed(6)}, ${decoded.lon.toFixed(6)}`
  document.getElementById('explore-error').textContent =
    `\u00b1${decoded.error.lat.toFixed(6)}\u00b0 lat, \u00b1${decoded.error.lon.toFixed(6)}\u00b0 lon`

  document.getElementById('explore-code').innerHTML = codeSnippet([
    `import { encode, decode, neighbours } from 'geohash-kit'`,
    ``,
    `const hash = encode(${lat.toFixed(4)}, ${lon.toFixed(4)}, ${precision})`,
    `// '${hash}'`,
    ``,
    `const decoded = decode('${hash}')`,
    `// { lat: ${decoded.lat.toFixed(6)}, lon: ${decoded.lon.toFixed(6)} }`,
    ``,
    `const adj = neighbours('${hash}')`,
    `// { n: '${adj.n}', ne: '${adj.ne}', e: '${adj.e}', ... }`,
  ])

  // Draw cells
  layers.explore.clearLayers()
  drawCell(layers.explore, hash, { fillOpacity: 0.35, weight: 2 })
  Object.values(adj).forEach(h =>
    drawCell(layers.explore, h, { fillOpacity: 0.12, weight: 1 })
  )
}

// =====================================================
//  COVER TAB
// =====================================================

const coverMaxCells = document.getElementById('cover-max-cells')
const coverMaxCellsValue = document.getElementById('cover-max-cells-value')
const coverMerge = document.getElementById('cover-merge')
const coverMergeValue = document.getElementById('cover-merge-value')
const coverClear = document.getElementById('cover-clear')

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
  drawnItems.clearLayers()
  layers.cover.clearLayers()
  document.getElementById('cover-info').classList.add('hidden')
})

map.on(L.Draw.Event.CREATED, (e) => {
  drawnItems.clearLayers()
  layers.cover.clearLayers()
  drawnItems.addLayer(e.layer)

  // Extract [lon, lat] pairs from drawn polygon
  const latlngs = e.layer.getLatLngs()[0]
  coverPolygon = latlngs.map(ll => [ll.lng, ll.lat])
  // Close the ring
  coverPolygon.push([...coverPolygon[0]])

  renderCover()
})

function renderCover() {
  const maxCells = parseInt(coverMaxCells.value)
  const mergeThreshold = parseFloat(coverMerge.value)

  let hashes
  try {
    hashes = polygonToGeohashes(coverPolygon, { maxCells, mergeThreshold })
  } catch (err) {
    document.getElementById('cover-info').classList.remove('hidden')
    document.getElementById('cover-count').textContent = `Error: ${err.message}`
    document.getElementById('cover-range').textContent = '\u2014'
    document.getElementById('cover-code').innerHTML = ''
    layers.cover.clearLayers()
    return
  }

  // Precision range
  const precisions = hashes.map(h => h.length)
  const minP = Math.min(...precisions)
  const maxP = Math.max(...precisions)

  // Update panel
  document.getElementById('cover-info').classList.remove('hidden')
  document.getElementById('cover-count').textContent = `${hashes.length} cells`
  document.getElementById('cover-range').textContent = minP === maxP ? `${minP}` : `${minP}\u2013${maxP}`

  const polyStr = coverPolygon.slice(0, 3).map(p => `[${p[0].toFixed(2)}, ${p[1].toFixed(2)}]`).join(', ')
  document.getElementById('cover-code').innerHTML = codeSnippet([
    `import { polygonToGeohashes } from 'geohash-kit'`,
    ``,
    `const hashes = polygonToGeohashes(`,
    `  [${polyStr}, ...],`,
    `  { maxCells: ${maxCells}, mergeThreshold: ${mergeThreshold} }`,
    `)`,
    `// ${hashes.length} cells (precision ${minP === maxP ? minP : minP + '\u2013' + maxP})`,
  ])

  // Draw cells
  layers.cover.clearLayers()
  hashes.forEach(h => drawCell(layers.cover, h))
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
const RING_COLOURS = ['#4fc3f7', '#66bb6a', '#ffa726', '#ef5350']

function renderNostr() {
  const { lat, lng: lon } = nostrLatLng
  const radius = parseInt(nostrRadius.value)
  const ringCount = parseInt(nostrRings.value)

  const hash = encode(lat, lon)
  const ladder = createGTagLadder(hash)
  const filter = createGTagFilter(lat, lon, radius)
  const rings = expandRings(hash, ringCount)

  // Update panel
  document.getElementById('nostr-info').classList.remove('hidden')

  document.getElementById('nostr-ladder').innerHTML =
    ladder.map(t => `["g", "${t[1]}"]`).join('\n')

  document.getElementById('nostr-filter').innerHTML =
    JSON.stringify(filter, null, 2)

  document.getElementById('nostr-code').innerHTML = codeSnippet([
    `import { createGTagLadder, createGTagFilter } from 'geohash-kit'`,
    ``,
    `const ladder = createGTagLadder('${hash}')`,
    `// ${ladder.length} tags from precision 1 to ${hash.length}`,
    ``,
    `const filter = createGTagFilter(${lat.toFixed(4)}, ${lon.toFixed(4)}, ${radius})`,
    `// { '#g': [${filter['#g'].slice(0, 3).map(h => `'${h}'`).join(', ')}, ...] }`,
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
