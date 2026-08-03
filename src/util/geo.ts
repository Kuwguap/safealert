export interface LatLng {
  lat: number;
  lon: number;
}

// Great-circle distance in miles
export function distanceMi(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function timeAgo(iso: string | number): string {
  const then = typeof iso === 'number' ? iso : Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = d.getMinutes();
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Web-Mercator slippy-map tile math (fractional tile coordinates)
export function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}

export function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

export function tileXToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI * (1 - (2 * y) / 2 ** z);
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface Tile {
  key: string;
  z: number;
  x: number; // wrapped tile column
  y: number;
  left: number;
  top: number;
  size: number;
}

const TILE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 17;

// Free, no-key tile providers (production would use Mapbox/Google per proposal):
// street — CARTO Voyager (@2x for crisp text), best-in-class OSM cartography;
// satellite — Esri World Imagery + a place/road label overlay on top.
export const TILE_PROVIDERS = {
  street: (t: Tile) => `https://basemaps.cartocdn.com/rastertiles/voyager/${t.z}/${t.x}/${t.y}@2x.png`,
  satellite: (t: Tile) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${t.z}/${t.y}/${t.x}`,
  satelliteLabels: (t: Tile) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${t.z}/${t.y}/${t.x}`,
} as const;

// Tiles covering a panel of w×h px centered exactly on `center` at zoom z.
// z may be fractional: tiles come from the nearest integer level and are
// scaled to match.
export function tilesForView(center: LatLng, z: number, w: number, h: number): Tile[] {
  const tz = clamp(Math.round(z), MIN_ZOOM, MAX_ZOOM);
  const scale = 2 ** (z - tz);
  const size = TILE * scale; // rendered tile size in px
  const cx = lonToTileX(center.lon, tz) * size; // scaled world px of center
  const cy = latToTileY(center.lat, tz) * size;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const maxTile = 2 ** tz;
  const tiles: Tile[] = [];
  for (let ty = Math.floor(top / size); ty * size < top + h; ty++) {
    for (let tx = Math.floor(left / size); tx * size < left + w; tx++) {
      if (ty < 0 || ty >= maxTile) continue;
      const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
      tiles.push({
        key: `${tz}/${ty}/${tx}`,
        z: tz,
        x: wrappedX,
        y: ty,
        left: tx * size - left,
        top: ty * size - top,
        size,
      });
    }
  }
  return tiles;
}

// Screen offset (px from panel center) of a coordinate in a view
// centered on `center` at zoom z.
export function screenOffset(point: LatLng, center: LatLng, z: number): { dx: number; dy: number } {
  const tz = clamp(Math.round(z), MIN_ZOOM, MAX_ZOOM);
  const size = TILE * 2 ** (z - tz);
  return {
    dx: (lonToTileX(point.lon, tz) - lonToTileX(center.lon, tz)) * size,
    dy: (latToTileY(point.lat, tz) - latToTileY(center.lat, tz)) * size,
  };
}

// Move a view center by a screen-pixel delta (for drag panning).
export function panCenter(center: LatLng, z: number, dxPx: number, dyPx: number): LatLng {
  const tz = clamp(Math.round(z), MIN_ZOOM, MAX_ZOOM);
  const size = TILE * 2 ** (z - tz);
  const x = lonToTileX(center.lon, tz) - dxPx / size;
  const y = clamp(latToTileY(center.lat, tz) - dyPx / size, 0, 2 ** tz);
  return { lon: tileXToLon(x, tz), lat: tileYToLat(y, tz) };
}
