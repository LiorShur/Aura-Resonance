/**
 * PROTOTYPE Fracture seeder from OpenStreetMap public-space POIs (see
 * docs/SCALING.md — the first step of an eventual "propose from POI data"
 * pipeline). Queries the Overpass API for PUBLICLY ACCESSIBLE, stand-able places
 * near a point and emits a fractures.geojson DRAFT.
 *
 *   npx tsx scripts/poi-seed.ts <lat> <lng> [radiusM=800] [count=20] > out.geojson
 *   npm run poi:seed -- -33.9427 18.4034 800 24 > scripts/data/fractures.cape.geojson
 *
 * Selection is ACCESSIBILITY-FIRST: places tagged access=private/no/customers are
 * rejected, and bare parks/gardens (often private) are excluded in favour of
 * squares, pedestrian plazas, marketplaces, tourist/historic landmarks, community
 * centres, and libraries — public by nature and easy for a player to find.
 *
 * ⚠ Still UNVERIFIED. OSM tags are not a safety guarantee — every point MUST be
 *   eyeballed against satellite imagery (SAFETY §5) before it reaches players.
 *   Community centres / care homes for real volunteering are PARTNERSHIPS, not
 *   scraped POIs (safeguarding) — see docs/SCALING.md.
 *
 * Logs + the review links go to stderr so stdout stays clean GeoJSON.
 */

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const SPACING_M = 25;

// Public, legible, stand-able categories. Deliberately NOT bare parks/gardens.
const SELECTORS = [
  'nwr["place"="square"]',
  'way["highway"="pedestrian"]',
  'nwr["amenity"="marketplace"]',
  'nwr["amenity"="community_centre"]',
  'nwr["amenity"="library"]',
  'nwr["amenity"="townhall"]',
  'nwr["tourism"="attraction"]',
  'node["tourism"="viewpoint"]',
  'node["tourism"="artwork"]',
  'nwr["historic"="monument"]',
  'nwr["historic"="memorial"]',
  'node["amenity"="fountain"]',
  'node["amenity"="drinking_water"]',
  'node["amenity"="bench"]',
];

// Anything tagged with these access values is NOT open to the public — reject.
const PRIVATE_ACCESS = new Set([
  'private', 'no', 'customers', 'permit', 'agricultural', 'forestry', 'delivery', 'military',
]);

// Fracture types → seeded templateIds (must exist in quest-templates.json).
const TEMPLATES: Record<string, string[]> = {
  kindness: ['litter-01', 'greet-01', 'echo-01', 'nature-01', 'help-01', 'gratitude-01', 'community-01'],
  high_tension: ['breathe-01', 'breathe-02', 'breathe-03', 'breathe-04'],
  coop: ['coop-01', 'coop-02', 'coop-03'],
};
const RADIUS: Record<string, number> = { kindness: 50, high_tension: 60, coop: 70 };

type Category = 'social' | 'scenic';

interface Tags {
  [k: string]: string | undefined;
}
interface Element {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

/** Classify a POI, or reject it (null). Access-private is always rejected. */
function classify(tags: Tags): { category: Category; named: boolean } | null {
  if (tags.access && PRIVATE_ACCESS.has(tags.access)) return null;
  const named = Boolean(tags.name);

  // Busy, social places — good for kindness acts and co-op meetups.
  if (
    tags.place === 'square' ||
    tags.highway === 'pedestrian' ||
    tags.amenity === 'marketplace' ||
    tags.amenity === 'community_centre' ||
    tags.amenity === 'library' ||
    tags.amenity === 'townhall' ||
    tags.tourism === 'attraction'
  ) {
    return { category: 'social', named };
  }
  // Quiet, scenic anchors — good for a breathing pause.
  if (
    tags.tourism === 'viewpoint' ||
    tags.tourism === 'artwork' ||
    tags.historic === 'monument' ||
    tags.historic === 'memorial' ||
    tags.amenity === 'fountain' ||
    tags.amenity === 'bench'
  ) {
    return { category: 'scenic', named };
  }
  // Small public utilities — usable, but low priority (kindness).
  if (tags.amenity === 'drinking_water') return { category: 'social', named: false };
  return null;
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
    `);out center tags ${count * 10};`;

  console.error(`[poi-seed] querying Overpass around ${lat},${lng} (${radius}m)…`);
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
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
  const raw = data.elements ?? [];
  console.error(`[poi-seed] ${raw.length} raw POIs returned.`);

  // Classify + reject private/uncategorised, keep coordinates.
  interface Candidate {
    lat: number;
    lng: number;
    category: Category;
    named: boolean;
    name: string;
  }
  const candidates: Candidate[] = [];
  for (const el of raw) {
    const lat2 = el.lat ?? el.center?.lat;
    const lng2 = el.lon ?? el.center?.lon;
    if (typeof lat2 !== 'number' || typeof lng2 !== 'number') continue;
    const c = classify(el.tags ?? {});
    if (!c) continue;
    candidates.push({ lat: lat2, lng: lng2, category: c.category, named: c.named, name: el.tags?.name ?? '' });
  }

  // Prefer NAMED places (more legible), then space them out.
  candidates.sort((a, b) => Number(b.named) - Number(a.named));
  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.some((p) => distanceM(p, c) < SPACING_M)) continue;
    picked.push(c);
    if (picked.length >= count) break;
  }
  const social = picked.filter((p) => p.category === 'social').length;
  console.error(
    `[poi-seed] ${picked.length} candidates after access-filter + spacing ` +
      `(${social} social, ${picked.length - social} scenic).`,
  );

  // Map category → Fracture type: social mostly kindness (every 5th a co-op
  // meetup point); scenic → breathing. Template IDs cycle within each type.
  const counts: Record<string, number> = {};
  let socialSeen = 0;
  const features = picked.map((c) => {
    let type: string;
    if (c.category === 'scenic') type = 'high_tension';
    else type = ++socialSeen % 5 === 0 ? 'coop' : 'kindness';
    const n = (counts[type] = (counts[type] ?? 0) + 1);
    const templates = TEMPLATES[type]!;
    return {
      type: 'Feature',
      properties: {
        type,
        templateId: templates[(n - 1) % templates.length]!,
        radiusM: RADIUS[type]!,
        activeHours: { from: 6, to: 21 },
        ...(c.name ? { osmName: c.name } : {}),
      },
      geometry: { type: 'Point', coordinates: [Number(c.lng.toFixed(6)), Number(c.lat.toFixed(6))] },
    };
  });

  const out = {
    type: 'FeatureCollection',
    metadata: {
      note:
        'DRAFT from OpenStreetMap public POIs via scripts/poi-seed.ts (access-filtered). ' +
        'UNVERIFIED — eyeball every point on satellite (SAFETY §5) and trim before use. ' +
        'Coordinates are [lng, lat]. osmName is a hint only.',
      source: `overpass around ${radius}m of ${lat},${lng}`,
      neighbourhoodId: 'draft',
    },
    features,
  };

  process.stdout.write(JSON.stringify(out, null, 2) + '\n');

  console.error(
    `\n[poi-seed] ${features.length} candidates. REVIEW EACH on satellite before seeding ` +
      `(SAFETY §5) — a person must be able to safely, publicly stand there:`,
  );
  features.forEach((f, i) => {
    const [clng, clat] = f.geometry.coordinates as [number, number];
    const sat = `https://www.google.com/maps/@${clat},${clng},20z/data=!3m1!1e3`;
    const label = (f.properties as { osmName?: string }).osmName ?? '(unnamed)';
    console.error(`  #${String(i + 1).padStart(2)} ${f.properties.type.padEnd(12)} ${sat}  ${label}`);
  });
  console.error(
    `\n[poi-seed] Trim to the spots you approve, then:` +
      `\n  npm run seed:verify -- <your-draft>.geojson   (re-check + links)` +
      `\n  # copy over scripts/data/fractures.geojson, then  npm run seed:live\n`,
  );
}

main().catch((err) => {
  console.error('[poi-seed] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
