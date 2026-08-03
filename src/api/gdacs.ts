import { distanceMi, LatLng } from '../util/geo';
import { ActiveAlert, AlertType } from './nws';

// GDACS — Global Disaster Alert and Coordination System (UN/EC).
// Worldwide flood / earthquake / cyclone / drought / wildfire / volcano
// events, free and keyless. This gives Ghana (and everywhere outside NWS
// coverage) a real alert source.

const EVENT_NAMES: Record<string, string> = {
  FL: 'Flood',
  EQ: 'Earthquake',
  TC: 'Tropical Cyclone',
  DR: 'Drought',
  WF: 'Wildfire',
  VO: 'Volcanic Activity',
};

function typeFor(eventType: string): AlertType {
  return eventType === 'FL' ? 'flood' : 'weather';
}

function severityFor(alertLevel: string): string {
  switch ((alertLevel || '').toLowerCase()) {
    case 'red':
      return 'Extreme';
    case 'orange':
      return 'Severe';
    default:
      return 'Moderate';
  }
}

const NEARBY_MI = 500; // events within this range of the active location

export async function fetchGdacsAlerts(center: LatLng): Promise<ActiveAlert[]> {
  const res = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`gdacs ${res.status}`);
  const json = await res.json();

  const alerts: ActiveAlert[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const centroid = { lon: coords[0], lat: coords[1] };
    const distance = distanceMi(center, centroid);
    if (distance > NEARBY_MI) continue;

    const eventName = EVENT_NAMES[p.eventtype] ?? p.eventtype ?? 'Disaster';
    const country = p.country || p.iso3 || '';
    alerts.push({
      id: `gdacs-${p.eventtype}-${p.eventid}`,
      type: typeFor(p.eventtype),
      event: `${eventName}${p.alertlevel ? ` (${p.alertlevel})` : ''}`,
      headline: p.htmldescription || p.name || `${eventName} — ${country}`,
      description: [p.htmldescription, p.description, country && `Affected area: ${country}.`]
        .filter(Boolean)
        .join('\n\n'),
      instruction: null,
      severity: severityFor(p.alertlevel),
      urgency: p.iscurrent === 'true' || p.iscurrent === true ? 'Ongoing' : 'Past',
      areaDesc: country || eventName,
      sent: p.fromdate ?? '',
      expires: p.todate ?? '',
      senderName: 'GDACS (UN global disaster feed)',
      centroid,
      distanceMi: distance,
    });
  }
  alerts.sort((a, b) => (a.distanceMi ?? 1e9) - (b.distanceMi ?? 1e9));
  return alerts;
}
