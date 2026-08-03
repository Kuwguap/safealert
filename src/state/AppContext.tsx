import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityEvent, community, CommunityAlert } from '../api/community';
import { fetchGdacsAlerts } from '../api/gdacs';
import { ActiveAlert, AlertType, fetchAlerts } from '../api/nws';
import { fetchWeather, Weather } from '../api/openMeteo';
import { nearestLandmark } from '../api/overpass';
import { ensureNotifyPermission, sendLocalNotification } from '../notify';
import { distanceMi, LatLng } from '../util/geo';
import { useAuth } from './AuthContext';

export interface SavedPlace {
  id: string;
  label: string;
  place: string;
  lat: number;
  lon: number;
}

export interface Settings {
  unit: 'fahrenheit' | 'celsius';
  defaultMapView: '3d' | 'street' | 'satellite';
  enabledTypes: Record<AlertType, boolean>;
}

const DEFAULT_SETTINGS: Settings = {
  unit: 'celsius',
  defaultMapView: 'street',
  enabledTypes: { amber: true, flood: true, weather: true },
};

// Default area when GPS is unavailable: KNUST, Kumasi.
const FALLBACK_CENTER: LatLng = { lat: 6.6745, lon: -1.5716 };
const FALLBACK_LABEL = 'KNUST, Kumasi';

const PLACES_KEY = 'safealert.places';
const SETTINGS_KEY = 'safealert.settings';

// Community bulletin → the shared alert shape the screens consume
function toActiveAlert(c: CommunityAlert, center: LatLng): ActiveAlert {
  const sender =
    c.source === 'broadcast'
      ? `SafeAlert broadcast · ${c.author}`
      : c.source === 'community'
        ? `Community report · ${c.author}`
        : `SafeAlert bulletin · ${c.author}`;
  return {
    id: c.id,
    type: c.type,
    event: c.event,
    headline: c.headline,
    description: c.description,
    instruction: null,
    severity: c.severity,
    urgency: 'Immediate',
    areaDesc: c.areaDesc,
    sent: c.sent,
    expires: '',
    senderName: sender,
    centroid: { lat: c.lat, lon: c.lon },
    distanceMi: distanceMi(center, { lat: c.lat, lon: c.lon }),
  };
}

// One toast/notification payload for anything that arrives: feed alerts,
// broadcasts, or an SOS from someone who listed you as a contact.
export interface Notice {
  alertId?: string;
  title: string;
  body: string;
  tone: 'amber' | 'flood' | 'sos';
}

interface AppState {
  center: LatLng;
  locationLabel: string;
  locationSource: 'gps' | 'place' | 'fallback';
  activePlaceId: string | null;
  places: SavedPlace[];
  settings: Settings;
  weather: Weather | null;
  alerts: ActiveAlert[]; // community bulletins first, then live NWS feed
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  incoming: Notice | null; // in-app toast payload
  backendOk: boolean | null;
  showNotice: (n: Notice) => void; // fire the in-app toast directly (tests/previews)
  dismissIncoming: () => void;
  refresh: () => Promise<void>;
  retryLocation: () => void;
  setActivePlace: (id: string | null) => void;
  addPlace: (p: Omit<SavedPlace, 'id'>) => void;
  removePlace: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

const POLL_MS = 20000; // backend poll — the demo's "push" channel

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [gps, setGps] = useState<{ center: LatLng; label: string } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [nwsAlerts, setNwsAlerts] = useState<ActiveAlert[]>([]);
  const [communityAlerts, setCommunityAlerts] = useState<CommunityAlert[]>(community.getAlerts());
  const [events, setEvents] = useState<ActivityEvent[]>(community.getEvents());
  const [backendOk, setBackendOk] = useState<boolean | null>(community.backendOk());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<Notice | null>(null);
  const fetchSeq = useRef(0);
  const knownIds = useRef<Set<string> | null>(null);
  const knownEventIds = useRef<Set<string> | null>(null);

  // Load persisted places/settings; subscribe to the community store and
  // poll it so other devices' posts/broadcasts/SOS arrive within seconds
  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([AsyncStorage.getItem(PLACES_KEY), AsyncStorage.getItem(SETTINGS_KEY)]);
        if (p) setPlaces(JSON.parse(p));
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
      } catch {
        // first run / corrupted storage — keep defaults
      }
    })();
    ensureNotifyPermission();
    const unsubscribe = community.subscribe(() => {
      setCommunityAlerts([...community.getAlerts()]);
      setEvents([...community.getEvents()]);
      setBackendOk(community.backendOk());
    });
    const interval = setInterval(() => community.poll(), POLL_MS);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Human label for a coordinate: closest landmark first, then reverse
  // geocode, then coordinates as a last resort.
  const labelFor = async (center: LatLng): Promise<string> => {
    const landmark = await nearestLandmark(center);
    if (landmark) return `Near ${landmark}`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: center.lat, longitude: center.lon });
      const g = geo[0];
      if (g) {
        const label = [g.city ?? g.subregion ?? g.district, g.region ?? g.country].filter(Boolean).join(', ');
        if (label) return label;
      }
    } catch {
      // reverse geocoding unavailable (e.g. web)
    }
    return `${center.lat.toFixed(3)}, ${center.lon.toFixed(3)}`;
  };

  // Apply a GPS fix immediately (center first, pretty label async) and skip
  // label recomputation for tiny moves so Overpass isn't hammered.
  const labeledAt = useRef<LatLng | null>(null);
  const applyFix = useCallback((lat: number, lon: number) => {
    const center = { lat, lon };
    setGps((prev) => ({ center, label: prev?.label ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}` }));
    if (labeledAt.current && distanceMi(labeledAt.current, center) < 0.2) return;
    labeledAt.current = center;
    labelFor(center).then((label) =>
      setGps((prev) => (prev && Math.abs(prev.center.lat - lat) < 1e-6 ? { center, label } : prev))
    );
  }, []);

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const resolveLocation = useCallback(async () => {
    setGpsDenied(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsDenied(true);
        return;
      }
      // 1. cached fix — instant, however coarse
      Location.getLastKnownPositionAsync()
        .then((last) => last && applyFix(last.coords.latitude, last.coords.longitude))
        .catch(() => {});
      // 2. fresh balanced fix with a hard 12s cap so nothing ever hangs
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((r) => setTimeout(() => r(null), 12000)),
      ]);
      if (fresh) applyFix(fresh.coords.latitude, fresh.coords.longitude);
      // 3. keep refining in the background as accuracy improves / user moves
      watcher.current?.remove();
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 50 },
        (fix) => applyFix(fix.coords.latitude, fix.coords.longitude)
      );
    } catch {
      setGps((g) => {
        if (!g) setGpsDenied(true);
        return g;
      });
    }
  }, [applyFix]);

  useEffect(() => {
    resolveLocation();
    return () => watcher.current?.remove();
  }, [resolveLocation]);

  const activePlace = activePlaceId ? places.find((p) => p.id === activePlaceId) ?? null : null;
  const center = activePlace ? { lat: activePlace.lat, lon: activePlace.lon } : gps?.center ?? FALLBACK_CENTER;
  const locationLabel = activePlace ? activePlace.place : gps?.label ?? FALLBACK_LABEL;
  const locationSource: AppState['locationSource'] = activePlace ? 'place' : gps ? 'gps' : 'fallback';

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    const [w, a, g] = await Promise.allSettled([
      fetchWeather(center, settings.unit),
      fetchAlerts(center), // US NWS — empty outside the US
      fetchGdacsAlerts(center), // GDACS — global (incl. Ghana/West Africa)
    ]);
    if (seq !== fetchSeq.current) return;
    if (w.status === 'fulfilled') setWeather(w.value);
    const feed: ActiveAlert[] = [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(g.status === 'fulfilled' ? g.value : []),
    ];
    if (a.status === 'fulfilled' || g.status === 'fulfilled') setNwsAlerts(feed);
    if (w.status === 'rejected' && a.status === 'rejected' && g.status === 'rejected') {
      setError('Could not reach alert services — check your connection.');
    } else {
      setLastUpdated(Date.now());
    }
    setLoading(false);
  }, [center.lat, center.lon, settings.unit]);

  // Load immediately with whatever center we have (fallback → GPS refines it);
  // never block the feed on location acquisition.
  useEffect(() => {
    load();
  }, [load]);

  const persistPlaces = (next: SavedPlace[]) => {
    setPlaces(next);
    AsyncStorage.setItem(PLACES_KEY, JSON.stringify(next)).catch(() => {});
  };

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch, enabledTypes: { ...prev.enabledTypes, ...patch.enabledTypes } };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const alerts = useMemo(() => {
    const communityMapped = communityAlerts.map((c) => toActiveAlert(c, center));
    return [...communityMapped, ...nwsAlerts].filter((a) => settings.enabledTypes[a.type]);
  }, [communityAlerts, nwsAlerts, settings.enabledTypes, center.lat, center.lon]);

  // New alert arrivals → local notification + in-app toast.
  // The first population after sign-in only seeds the known set.
  useEffect(() => {
    const ids = new Set(alerts.map((a) => a.id));
    if (knownIds.current) {
      const fresh = alerts.find((a) => !knownIds.current!.has(a.id));
      if (fresh) {
        setIncoming({
          alertId: fresh.id,
          title: fresh.event,
          body: fresh.headline,
          tone: fresh.type === 'amber' ? 'amber' : 'flood',
        });
        sendLocalNotification(fresh.event, fresh.headline);
      }
    } else if (alerts.length > 0 || lastUpdated) {
      knownIds.current = ids;
      return;
    }
    if (knownIds.current) knownIds.current = ids;
  }, [alerts, lastUpdated]);

  // SOS from someone who listed me as an emergency contact → urgent notice.
  // On the first load after opening the app, still surface any targeted SOS
  // from the last 10 minutes — missing one because the app was closed would
  // defeat the point.
  useEffect(() => {
    const myEmail = auth.user?.email;
    const ids = new Set(events.map((e) => e.id));
    if (myEmail) {
      const firstRun = knownEventIds.current === null;
      const targetsMe = (e: ActivityEvent) =>
        e.kind === 'sos' && e.targetEmails?.includes(myEmail) && e.userEmail !== myEmail;
      const fresh = events.find(
        (e) =>
          targetsMe(e) &&
          (firstRun
            ? Date.now() - Date.parse(e.ts) < 10 * 60 * 1000
            : !knownEventIds.current!.has(e.id))
      );
      if (fresh) {
        const title = `🆘 SOS from ${fresh.user}`;
        const body = `${fresh.locationLabel || 'Location shared'} · ${fresh.detail}`;
        setIncoming({ title, body, tone: 'sos' });
        sendLocalNotification(title, body);
      }
    }
    knownEventIds.current = ids;
  }, [events, auth.user?.email]);

  const value: AppState = {
    center,
    locationLabel,
    locationSource,
    activePlaceId,
    places,
    settings,
    weather,
    alerts,
    loading,
    error,
    lastUpdated,
    incoming,
    backendOk,
    showNotice: setIncoming,
    dismissIncoming: () => setIncoming(null),
    refresh: async () => {
      await Promise.all([load(), community.poll()]);
    },
    retryLocation: resolveLocation,
    setActivePlace: setActivePlaceId,
    addPlace: (p) => persistPlaces([...places, { ...p, id: `${Date.now()}` }]),
    removePlace: (id) => {
      if (activePlaceId === id) setActivePlaceId(null);
      persistPlaces(places.filter((x) => x.id !== id));
    },
    updateSettings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
