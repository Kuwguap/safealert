import { distanceMi, LatLng } from '../util/geo';

// OpenStreetMap Overpass API — free POI data, no key required.
// Powers the map's landmark markers (schools, hospitals, police, fire
// stations), place-name labels, and "closest landmark" location labels.

export type PoiKind = 'school' | 'hospital' | 'police' | 'fire' | 'place';

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lon: number;
}

const AMENITY_KINDS: Record<string, PoiKind> = {
  school: 'school',
  university: 'school',
  college: 'school',
  hospital: 'hospital',
  clinic: 'hospital',
  police: 'police',
  fire_station: 'fire',
};

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const cache = new Map<string, Poi[]>();
const pending = new Map<string, Promise<Poi[]>>();

async function runQuery(query: string): Promise<any> {
  let lastErr: unknown = null;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return await res.json();
      lastErr = new Error(`overpass ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function parsePois(json: any, center: LatLng): Poi[] {
  const seen = new Set<string>();
  const pois: Poi[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const name: string | undefined = tags.name;
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const kind: PoiKind | undefined = tags.amenity ? AMENITY_KINDS[tags.amenity] : tags.place ? 'place' : undefined;
    if (!kind) continue;
    // dedupe by name+kind (campuses often have many tagged elements)
    const key = `${kind}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pois.push({ id: `${el.type}/${el.id}`, name, kind, lat, lon });
  }
  pois.sort((a, b) => distanceMi(center, a) - distanceMi(center, b));
  return pois;
}

// POIs + place labels around a point. radiusM is clamped to keep Overpass fast.
export async function fetchPois(center: LatLng, radiusM: number): Promise<Poi[]> {
  const r = Math.round(Math.min(6000, Math.max(700, radiusM)));
  const key = `${center.lat.toFixed(3)},${center.lon.toFixed(3)},${Math.round(r / 500)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const amenity = '^(school|university|college|hospital|clinic|police|fire_station)$';
  const query = `[out:json][timeout:12];(
node["amenity"~"${amenity}"]["name"](around:${r},${center.lat},${center.lon});
way["amenity"~"${amenity}"]["name"](around:${r},${center.lat},${center.lon});
node["place"~"^(suburb|neighbourhood|quarter|town|village|city)$"]["name"](around:${Math.min(9000, r * 2)},${center.lat},${center.lon});
);out center 80;`;

  const task = (async () => {
    try {
      const json = await runQuery(query);
      const pois = parsePois(json, center);
      cache.set(key, pois);
      return pois;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, task);
  return task;
}

// "Closest landmark" label for a coordinate, e.g. "Near KNUST Hospital".
export async function nearestLandmark(center: LatLng): Promise<string | null> {
  try {
    const pois = await fetchPois(center, 1800);
    const landmark = pois.find((p) => p.kind !== 'place') ?? pois[0];
    return landmark ? landmark.name : null;
  } catch {
    return null;
  }
}
