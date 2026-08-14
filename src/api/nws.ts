import { distanceMi, LatLng } from '../util/geo';

// US National Weather Service active-alerts API — free, no key.
// Covers weather + flood alerts and AMBER alerts (event "Child Abduction Emergency").
// Outside NWS coverage (non-US) the feed is simply empty.

export type AlertType = 'amber' | 'flood' | 'weather';

export interface ActiveAlert {
  id: string;
  type: AlertType;
  event: string; // e.g. "Flood Watch"
  headline: string;
  description: string;
  instruction: string | null;
  severity: string; // Minor | Moderate | Severe | Extreme | Unknown
  urgency: string;
  areaDesc: string;
  sent: string; // ISO
  expires: string; // ISO
  senderName: string;
  centroid: LatLng | null;
  distanceMi: number | null; // from the active location, when geometry known
  imageUrl?: string | null; // community/admin bulletins may attach a photo
}

function classify(event: string): AlertType {
  const e = event.toLowerCase();
  if (e.includes('child abduction') || e.includes('amber')) return 'amber';
  if (e.includes('flood')) return 'flood';
  return 'weather';
}

function polygonCentroid(geometry: any): LatLng | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === 'Polygon') coords = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') coords = geometry.coordinates[0][0];
  if (!coords.length) return null;
  let lat = 0;
  let lon = 0;
  for (const [x, y] of coords) {
    lon += x;
    lat += y;
  }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

export async function fetchAlerts(center: LatLng): Promise<ActiveAlert[]> {
  const url = `https://api.weather.gov/alerts/active?point=${center.lat.toFixed(4)},${center.lon.toFixed(4)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/geo+json', 'User-Agent': 'SafeAlert (student project)' },
  });
  if (!res.ok) throw new Error(`alerts ${res.status}`);
  const json = await res.json();

  return (json.features ?? []).map((f: any): ActiveAlert => {
    const p = f.properties;
    const centroid = polygonCentroid(f.geometry);
    return {
      id: p.id ?? f.id,
      type: classify(p.event ?? ''),
      event: p.event ?? 'Alert',
      headline: p.headline ?? p.event ?? 'Alert',
      description: (p.description ?? '').trim(),
      instruction: p.instruction ? p.instruction.trim() : null,
      severity: p.severity ?? 'Unknown',
      urgency: p.urgency ?? 'Unknown',
      areaDesc: p.areaDesc ?? '',
      sent: p.sent ?? p.effective ?? '',
      expires: p.expires ?? '',
      senderName: p.senderName ?? 'National Weather Service',
      centroid,
      distanceMi: centroid ? distanceMi(center, centroid) : null,
    };
  });
}
