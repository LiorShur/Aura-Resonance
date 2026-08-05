import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { geohashForLocation } from 'geofire-common';
import { FieldValue } from 'firebase-admin/firestore';
import { seedDb } from './_admin';
import { loadFractureFeatures } from './verify-locations';

const DATA = fileURLToPath(new URL('./data/fractures.geojson', import.meta.url));

/**
 * Optional SEED_AT="lat,lng" recentres the whole example arrangement on a point
 * you choose (e.g. your own neighbourhood), so you can walk the real loop where
 * you are instead of in the default Tel Aviv area.
 */
function recentre(
  features: Array<{ lat: number; lng: number }>,
  at: string | undefined,
): void {
  if (!at) return;
  const [lat, lng] = at.split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`SEED_AT must be "lat,lng" (got "${at}")`);
  }
  const cLat = features.reduce((s, f) => s + f.lat, 0) / features.length;
  const cLng = features.reduce((s, f) => s + f.lng, 0) / features.length;
  const dLat = lat - cLat;
  const dLng = lng - cLng;
  for (const f of features) {
    f.lat += dLat;
    f.lng += dLng;
  }
  console.log(`[seed] recentred fractures on ${lat}, ${lng}`);
}

async function main() {
  const { features, neighbourhoodId } = loadFractureFeatures(
    JSON.parse(await readFile(DATA, 'utf8')),
  );
  recentre(features, process.env.SEED_AT);

  const db = seedDb();
  const batch = db.batch();

  features.forEach((f, i) => {
    const id = `${neighbourhoodId}-${String(i + 1).padStart(3, '0')}`;
    const geohash = geohashForLocation([f.lat, f.lng]);
    batch.set(db.collection('fractures').doc(id), {
      type: f.type,
      templateId: f.templateId,
      geo: { lat: f.lat, lng: f.lng, geohash },
      radiusM: f.radiusM,
      status: 'active',
      healedBy: [],
      healCount: 0,
      neighbourhoodId,
      activeHours: f.activeHours,
      createdAt: FieldValue.serverTimestamp(),
      respawnAt: null,
    });
  });

  await batch.commit();
  console.log(`[seed] wrote ${features.length} fractures to neighbourhood "${neighbourhoodId}"`);
  if (features.length < 40) {
    console.warn(
      `[seed] NOTE: only ${features.length} fractures. The pilot wants 40–60 hand-curated public locations (docs/GDD_v0.md §5).`,
    );
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
