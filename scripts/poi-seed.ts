/**
 * PROTOTYPE Fracture seeder from OpenStreetMap public-space POIs (see
 * docs/SCALING.md — the first step of an eventual "propose from POI data"
 * pipeline). Queries the Overpass API for safe, stand-able public features near a
 * point and emits a fractures.geojson DRAFT.
 *
 *   npx tsx scripts/poi-seed.ts <lat> <lng> [radiusM=800] [count=20] > out.geojson
 *   npx tsx scripts/poi-seed.ts -33.9427 18.4034 800 24 > scripts/data/fractures.cape.geojson
 *
 * ⚠ These are UNVERIFIED candidates. OSM data is not a safety guarantee — every
 *   point MUST still be eyeballed against satellite imagery (SAFETY §5) with
 *   `npm run seed:verify` before it goes anywhere near players. Trim ruthlessly.
 *
 * Logs go to stderr so stdout stays clean GeoJSON you can redirect to a file.
 */

// Public Overpass endpoint. Override with OVERPASS_URL if this one rate-limits
// or 403s — mirrors: https://overpass.kumi.systems/api/interpreter,
// https://maps.mail.ru/osm/tools/overpass/api/interpreter
const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const SPACING_M = 25; // don't place two Fractures on top of each other

// Only public, stand-able features — never roads, buildings, or private land.
const SELECTORS = [
  'node["amenity"="bench"]',
  'node["amenity"="drinking_water"]',
  'node["amenity"="fountain"]',
  'node["amenity"="public_bookcase"]',
  'node["tourism"="viewpoint"]',
  'node["tourism"="artwork"]',
  'nwr["leisure"="park"]',
  'nwr["leisure"="garden"]',
];

// Distribution of Fracture types, and the seeded templateIds each can use
// (must exist in scripts/data/quest-templates.json).
const TYPE_PLAN: Array<{ type: string; radiusM: number; templates: string[] }> = [
  { type: 'kindness', radiusM: 50, templates: ['litter-01', 'greet-01', 'echo-01', 'nature-01', 'help-01', 'gratitude-01', 'community-01'] },
  { type: 'high_tension', radiusM: 60, templates: ['breathe-01', 'breathe-02', 'breathe-03', 'breathe-04'] },
  { type: 'coop', radiusM: 70, templates: ['coop-01', 'coop-02', 'coop-03'] },
];
// ~70% kindness, ~20% high-tension, ~10% co-op, assigned round-robin by index.
const TYPE_SEQUENCE = ['kindness', 'kindness', 'kindness', 'kindness', 'kindness', 'kindness', 'kindness', 'high_tension', 'high_tension', 'coop'];

interface Element {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
}

const M_PER_DEG_LAT = 111_320;
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const mPerLng = M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * mPerLng, (a.lat - b.lat) * M_PER_DEG_LAT);
}

async function main() {
  const [latS, lngS, radiusS, countS] = process.argv.slice(2);
  const lat = Number(latS);
  const lng = Number(lngS);
  const radius = Number(radiusS ?? 800);
  const count = Number(countS ?? 20);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error('Usage: npx tsx scripts/poi-seed.ts <lat> <lng> [radiusM=800] [count=20]');
    process.exit(1);
  }

  const query =
    `[out:json][timeout:25];(` +
    SELECTORS.map((s) => `${s}(around:${radius},${lat},${lng});`).join('') +
    `);out center ${count * 8};`;

  console.error(`[poi-seed] querying Overpass around ${lat},${lng} (${radius}m)…`);
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass requires a real User-Agent and 403s generic clients.
      'User-Agent': 'aura-resonance-poi-seed/0.0 (pilot tooling)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    console.error(
      `[poi-seed] Overpass returned ${res.status}. It rate-limits and 403s bursts — ` +
        `wait a minute and retry, or set OVERPASS_URL to a mirror (see the top of this file).`,
    );
    process.exit(1);
  }
  const data = (await res.json()) as { elements?: Element[] };
  const elements = data.elements ?? [];
  console.error(`[poi-seed] ${elements.length} raw POIs returned.`);

  // Normalise to points, drop anything without coordinates, space them out.
  const picked: Array<{ lat: number; lng: number }> = [];
  for (const el of elements) {
    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (typeof lat2 !== 'number' || typeof lng2 !== 'number') continue;
    const pt = { lat: lat2, lng: lng2 };
    if (picked.some((p) => distanceM(p, pt) < SPACING_M)) continue;
    picked.push(pt);
    if (picked.length >= count) break;
  }
  console.error(`[poi-seed] ${picked.length} candidates after spacing (${SPACING_M}m apart).`);

  const typeCounts: Record<string, number> = {};
  const features = picked.map((pt, i) => {
    const typeName = TYPE_SEQUENCE[i % TYPE_SEQUENCE.length]!;
    const plan = TYPE_PLAN.find((t) => t.type === typeName)!;
    const n = (typeCounts[typeName] = (typeCounts[typeName] ?? 0) + 1);
    const templateId = plan.templates[(n - 1) % plan.templates.length]!;
    return {
      type: 'Feature',
      properties: { type: typeName, templateId, radiusM: plan.radiusM, activeHours: { from: 6, to: 21 } },
      geometry: { type: 'Point', coordinates: [Number(pt.lng.toFixed(6)), Number(pt.lat.toFixed(6))] },
    };
  });

  const out = {
    type: 'FeatureCollection',
    metadata: {
      note:
        'DRAFT from OpenStreetMap POIs via scripts/poi-seed.ts. UNVERIFIED — every ' +
        'point must be eyeballed against satellite imagery (SAFETY §5) and trimmed ' +
        'before use. Coordinates are [lng, lat].',
      source: `overpass around ${radius}m of ${lat},${lng}`,
      neighbourhoodId: 'draft',
    },
    features,
  };

  console.error(`[poi-seed] emitting ${features.length} features. REVIEW EACH before seeding.`);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((err) => {
  console.error('[poi-seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
