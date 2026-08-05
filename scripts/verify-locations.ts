import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * Structural / geographic sanity check for seed Fractures. This CANNOT confirm a
 * point is safe to stand at — it catches malformed data, out-of-area points,
 * overlaps, bad radii, and dangling template references. Human eyeballing
 * against satellite imagery (SAFETY.md §5) is still mandatory and is what the
 * final reminder is about.
 */

export interface FractureFeature {
  lat: number;
  lng: number;
  type: 'kindness' | 'high_tension' | 'coop';
  templateId: string;
  radiusM: number;
  activeHours: { from: number; to: number };
}

const TEMPLATES = fileURLToPath(new URL('./data/quest-templates.json', import.meta.url));
const DATA = fileURLToPath(new URL('./data/fractures.geojson', import.meta.url));

const M_PER_DEG_LAT = 111_320;
function distanceM(a: FractureFeature, b: FractureFeature): number {
  const mPerLng = M_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  const dx = (a.lng - b.lng) * mPerLng;
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Parse + hard-validate a GeoJSON FeatureCollection. Throws on structural FAIL. */
export function loadFractureFeatures(geojson: unknown): {
  features: FractureFeature[];
  neighbourhoodId: string;
} {
  const gj = geojson as {
    type?: string;
    metadata?: { neighbourhoodId?: string };
    features?: Array<{ properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } }>;
  };
  if (gj.type !== 'FeatureCollection' || !Array.isArray(gj.features)) {
    throw new Error('Not a GeoJSON FeatureCollection');
  }
  const neighbourhoodId = gj.metadata?.neighbourhoodId ?? 'unknown';

  const features: FractureFeature[] = gj.features.map((f, i) => {
    const coords = f.geometry?.coordinates;
    if (f.geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length !== 2) {
      throw new Error(`Feature ${i}: not a Point with [lng, lat]`);
    }
    const [lng, lat] = coords as [number, number];
    const p = f.properties ?? {};
    return {
      lat,
      lng,
      type: p.type as FractureFeature['type'],
      templateId: String(p.templateId ?? ''),
      radiusM: Number(p.radiusM),
      activeHours: p.activeHours as FractureFeature['activeHours'],
    };
  });

  return { features, neighbourhoodId };
}

interface Issue {
  index: number;
  level: 'FAIL' | 'WARN';
  message: string;
}

async function main() {
  const templateList: Array<{ id: string; type: string }> = JSON.parse(
    await readFile(TEMPLATES, 'utf8'),
  );
  const templateById = new Map(templateList.map((t) => [t.id, t]));

  // Verify a specific file if given (e.g. a poi-seed draft), else the canonical set.
  const arg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const dataPath = arg ? resolve(process.cwd(), arg) : DATA;
  const { features, neighbourhoodId } = loadFractureFeatures(
    JSON.parse(await readFile(dataPath, 'utf8')),
  );

  const issues: Issue[] = [];
  const add = (index: number, level: Issue['level'], message: string) =>
    issues.push({ index, level, message });

  // Centroid, for an out-of-area sanity bound (~2 km window).
  const cLat = features.reduce((s, f) => s + f.lat, 0) / features.length;
  const cLng = features.reduce((s, f) => s + f.lng, 0) / features.length;
  const centroid: FractureFeature = { lat: cLat, lng: cLng } as FractureFeature;

  features.forEach((f, i) => {
    if (f.lat < -90 || f.lat > 90 || f.lng < -180 || f.lng > 180) {
      add(i, 'FAIL', `coordinates out of range (${f.lat}, ${f.lng})`);
    }
    if (!['kindness', 'high_tension', 'coop'].includes(f.type)) {
      add(i, 'FAIL', `unknown type "${f.type}"`);
    }
    const tpl = templateById.get(f.templateId);
    if (!tpl) add(i, 'FAIL', `templateId "${f.templateId}" not found in quest-templates.json`);
    else if (tpl.type !== f.type) {
      add(i, 'WARN', `type "${f.type}" != template type "${tpl.type}" for ${f.templateId}`);
    }
    if (!Number.isFinite(f.radiusM)) add(i, 'FAIL', 'radiusM missing or not a number');
    else if (f.radiusM < 40 || f.radiusM > 80) add(i, 'WARN', `radiusM ${f.radiusM} outside 40–80 m`);

    const ah = f.activeHours;
    if (!ah || !Number.isInteger(ah.from) || !Number.isInteger(ah.to) || ah.from < 0 || ah.to > 24) {
      add(i, 'FAIL', 'activeHours missing or invalid');
    }
    if (distanceM(f, centroid) > 2000) {
      add(i, 'WARN', `${Math.round(distanceM(f, centroid))} m from centroid — outside the ~2 km test area?`);
    }
  });

  // Overlap check: check-in radii should not smother each other.
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const fi = features[i]!;
      const fj = features[j]!;
      const d = distanceM(fi, fj);
      if (d < 25) add(j, 'WARN', `only ${Math.round(d)} m from #${i + 1} — likely overlap`);
    }
  }

  // Report
  const fails = issues.filter((x) => x.level === 'FAIL');
  const warns = issues.filter((x) => x.level === 'WARN');

  console.log(`\nVerifying ${features.length} fractures in "${neighbourhoodId}"\n`);
  for (const { index, level, message } of issues) {
    const tag = level === 'FAIL' ? '✗ FAIL' : '⚠ WARN';
    console.log(`  ${tag}  #${index + 1}  ${message}`);
  }
  if (!issues.length) console.log('  ✓ no structural issues');

  // Satellite links — click each and confirm a person can safely STAND there:
  // not on a road, rail, water, private property, or inside a building (SAFETY §5).
  console.log('\n  Satellite check — open each and eyeball the exact spot:');
  features.forEach((f, i) => {
    const sat = `https://www.google.com/maps/@${f.lat},${f.lng},20z/data=!3m1!1e3`;
    console.log(`  #${String(i + 1).padStart(2)} ${f.type.padEnd(12)} ${sat}`);
  });

  console.log(`\n  ${fails.length} FAIL, ${warns.length} WARN`);
  if (features.length < 40) {
    console.log(`  ⚠ ${features.length} points — pilot target is 40–60 (GDD §5).`);
  }
  console.log(
    '\n  REMINDER: structural checks cannot see roads, water, or private land.\n' +
      '  Every point must still be eyeballed against satellite imagery before launch\n' +
      '  (SAFETY.md §5, §7 pre-launch checklist).\n',
  );

  if (fails.length) process.exit(1);
}

// Only run when invoked directly (not when seed-fractures imports the loader).
const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((err) => {
    console.error('verify failed:', err);
    process.exit(1);
  });
}
