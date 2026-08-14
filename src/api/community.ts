import AsyncStorage from '@react-native-async-storage/async-storage';
import { backend } from './backend';
import { AlertType } from './nws';

// Community store — bulletins (admin, community posts, broadcasts) and
// activity events (SOS, check-ins, tips), shared across devices through the
// Supabase backend. The last server snapshot is cached in AsyncStorage so the
// feed still renders offline; writes fall back to local-only when the network
// is down (per the proposal's offline requirement).

export type BulletinSource = 'admin' | 'community' | 'broadcast';

export interface CommunityAlert {
  id: string;
  source: BulletinSource;
  type: AlertType;
  event: string;
  headline: string;
  description: string;
  severity: string;
  areaDesc: string;
  lat: number;
  lon: number;
  sent: string; // ISO
  author: string;
  imageUrl: string | null;
}

export type ActivityKind = 'sos' | 'checkin' | 'tip';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  user: string;
  userEmail: string;
  detail: string;
  locationLabel: string;
  lat: number;
  lon: number;
  targetEmails: string[];
  ts: string; // ISO
}

const CACHE_KEY = 'safealert.communityCache';

let alerts: CommunityAlert[] = [];
let events: ActivityEvent[] = [];
let loaded = false;
let lastPollOk: boolean | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function persistCache() {
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ alerts, events })).catch(() => {});
}

function rowToAlert(r: any): CommunityAlert {
  return {
    id: r.id,
    source: r.source ?? 'admin',
    type: r.type,
    event: r.event,
    headline: r.headline,
    description: r.description ?? '',
    severity: r.severity ?? 'Moderate',
    areaDesc: r.area_desc ?? '',
    lat: r.lat,
    lon: r.lon,
    sent: r.created_at,
    author: r.author ?? 'Anonymous',
    imageUrl: r.image_url ?? null,
  };
}

function rowToEvent(r: any): ActivityEvent {
  return {
    id: r.id,
    kind: r.kind,
    user: r.user_name ?? 'Anonymous',
    userEmail: r.user_email ?? '',
    detail: r.detail ?? '',
    locationLabel: r.location_label ?? '',
    lat: r.lat ?? 0,
    lon: r.lon ?? 0,
    targetEmails: r.target_emails ?? [],
    ts: r.created_at,
  };
}

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      alerts = parsed.alerts ?? [];
      events = parsed.events ?? [];
      emit();
    }
  } catch {
    // fresh install
  }
  poll();
}

// Pull the latest snapshot from the backend (called on start, on an
// interval, and by pull-to-refresh).
export async function poll(): Promise<boolean> {
  try {
    const [a, e] = await Promise.all([
      backend.select<any>('safealert_bulletins', 'select=*&order=created_at.desc&limit=50'),
      backend.select<any>('safealert_events', 'select=*&order=created_at.desc&limit=50'),
    ]);
    alerts = a.map(rowToAlert);
    events = e.map(rowToEvent);
    lastPollOk = true;
    persistCache();
    emit();
    return true;
  } catch {
    lastPollOk = false;
    emit();
    return false;
  }
}

export const community = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    ensureLoaded();
    return () => listeners.delete(listener);
  },
  getAlerts: () => alerts,
  getEvents: () => events,
  backendOk: () => lastPollOk,
  poll,

  async publishAlert(alert: Omit<CommunityAlert, 'id' | 'sent'>): Promise<CommunityAlert> {
    try {
      const row = await backend.insert<any>('safealert_bulletins', {
        source: alert.source,
        type: alert.type,
        event: alert.event,
        headline: alert.headline,
        description: alert.description,
        severity: alert.severity,
        area_desc: alert.areaDesc,
        lat: alert.lat,
        lon: alert.lon,
        author: alert.author,
        image_url: alert.imageUrl,
      });
      const full = rowToAlert(row);
      alerts = [full, ...alerts.filter((x) => x.id !== full.id)];
      persistCache();
      emit();
      return full;
    } catch {
      // offline — keep it locally so the demo still works
      const full: CommunityAlert = { ...alert, id: `local-${Date.now()}`, sent: new Date().toISOString() };
      alerts = [full, ...alerts];
      persistCache();
      emit();
      return full;
    }
  },

  async removeAlert(id: string) {
    alerts = alerts.filter((a) => a.id !== id);
    persistCache();
    emit();
    if (!id.startsWith('local-')) {
      backend.delete('safealert_bulletins', `id=eq.${id}`).catch(() => {});
    }
  },

  async clearAlerts() {
    alerts = [];
    persistCache();
    emit();
    backend.delete('safealert_bulletins', 'id=not.is.null').catch(() => {});
  },

  async logEvent(event: Omit<ActivityEvent, 'id' | 'ts'>) {
    try {
      const row = await backend.insert<any>('safealert_events', {
        kind: event.kind,
        user_name: event.user,
        user_email: event.userEmail,
        detail: event.detail,
        location_label: event.locationLabel,
        lat: event.lat,
        lon: event.lon,
        target_emails: event.targetEmails,
      });
      events = [rowToEvent(row), ...events].slice(0, 100);
    } catch {
      events = [
        { ...event, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: new Date().toISOString() },
        ...events,
      ].slice(0, 100);
    }
    persistCache();
    emit();
  },

  async clearEvents() {
    events = [];
    persistCache();
    emit();
    backend.delete('safealert_events', 'id=not.is.null').catch(() => {});
  },
};
