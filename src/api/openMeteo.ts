import { LatLng } from '../util/geo';

// Open-Meteo — free weather + geocoding APIs, no key required.

export interface HourlyTemp {
  time: string; // "3PM"
  temp: string; // "32°"
  cooling: boolean; // colder than the previous hour → tinted blue in the UI
}

export interface Weather {
  currentTemp: string;
  condition: string;
  hourly: HourlyTemp[];
}

const WMO_CONDITIONS: [number, string][] = [
  [0, 'Clear sky'],
  [1, 'Mostly clear'],
  [2, 'Partly cloudy'],
  [3, 'Overcast'],
  [45, 'Fog'],
  [48, 'Icy fog'],
  [51, 'Light drizzle'],
  [55, 'Drizzle'],
  [56, 'Freezing drizzle'],
  [61, 'Light rain'],
  [63, 'Rain'],
  [65, 'Heavy rain'],
  [66, 'Freezing rain'],
  [71, 'Light snow'],
  [73, 'Snow'],
  [75, 'Heavy snow'],
  [77, 'Snow grains'],
  [80, 'Rain showers'],
  [82, 'Heavy showers'],
  [85, 'Snow showers'],
  [95, 'Thunderstorm'],
  [96, 'Thunderstorm w/ hail'],
];

function conditionFor(code: number): string {
  let label = 'Clear sky';
  for (const [c, text] of WMO_CONDITIONS) {
    if (code >= c) label = text;
  }
  return label;
}

function hourLabel(iso: string): string {
  const h = new Date(iso).getHours();
  return `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;
}

export async function fetchWeather(center: LatLng, unit: 'celsius' | 'fahrenheit'): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lon}` +
    `&current=temperature_2m,weather_code&hourly=temperature_2m&forecast_days=2` +
    `&temperature_unit=${unit}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const json = await res.json();

  const now = Date.now();
  const times: string[] = json.hourly.time;
  const temps: number[] = json.hourly.temperature_2m;
  const start = times.findIndex((t) => Date.parse(t) > now);
  const hourly: HourlyTemp[] = [];
  for (let i = Math.max(0, start); i < times.length && hourly.length < 5; i++) {
    hourly.push({
      time: hourLabel(times[i]),
      temp: `${Math.round(temps[i])}°`,
      cooling: i > 0 && temps[i] < temps[i - 1],
    });
  }

  return {
    currentTemp: `${Math.round(json.current.temperature_2m)}°`,
    condition: conditionFor(json.current.weather_code),
    hourly,
  };
}

export interface PlaceResult {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

// Place search via OpenStreetMap Nominatim — much deeper Ghana coverage
// (suburbs, junctions, campuses) than global city geocoders. Results are
// Ghana-first; the worldwide search only runs when Ghana has few matches.
async function nominatim(query: string, countryCodes?: string): Promise<PlaceResult[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&addressdetails=1&limit=6${countryCodes ? `&countrycodes=${countryCodes}` : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const json = await res.json();
  return (json ?? []).map((r: any) => {
    const a = r.address ?? {};
    const region = [a.suburb ?? a.city_district, a.city ?? a.town ?? a.county, a.state ?? a.region, a.country]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 3)
      .join(', ');
    return {
      name: r.name || (r.display_name ?? '').split(',')[0],
      region,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    };
  });
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const ghana = await nominatim(query, 'gh');
  if (ghana.length >= 2) return ghana;
  const global = await nominatim(query);
  const seen = new Set(ghana.map((p) => `${p.lat},${p.lon}`));
  return [...ghana, ...global.filter((p) => !seen.has(`${p.lat},${p.lon}`))].slice(0, 6);
}
