import { Poi } from '../../api/overpass';
import { LatLng } from '../../util/geo';

// The 3D view is a static MapLibre page served from the hosted site
// (web/map3d.html → /safealert/map3d.html). Loading it over real HTTPS —
// rather than an inline srcdoc/html string — matters: MapLibre's tile worker
// silently fails to fetch vector tiles in srcdoc documents. A real origin
// also gives the native WebView a proper security context.
const MAP3D_BASE = 'https://kuwguap.github.io/safealert/map3d.html';

export function map3dUrl(center: LatLng, zoom: number, marker: LatLng): string {
  const q = new URLSearchParams({
    lat: center.lat.toFixed(5),
    lon: center.lon.toFixed(5),
    zoom: String(Math.round(zoom * 10) / 10),
    mlat: marker.lat.toFixed(5),
    mlon: marker.lon.toFixed(5),
  });
  return `${MAP3D_BASE}?${q.toString()}`;
}

export function poisToFeatures(pois: Poi[]) {
  return pois
    .filter((p) => p.kind !== 'place')
    .slice(0, 40)
    .map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { kind: p.kind, name: p.name },
    }));
}
