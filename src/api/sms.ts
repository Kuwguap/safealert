import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';
import { getAccessToken, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { EmergencyContact } from '../state/AuthContext';
import { LatLng } from '../util/geo';

// SOS text messages — two channels:
// 1. Automatic: the `send-sms` Supabase Edge Function relays through Arkesel
//    (Ghanaian SMS gateway). The API key lives server-side only; the function
//    authenticates the caller and rate-caps recipients. kind 'sos' texts the
//    sender's emergency contacts; kind 'amber' (admins) blasts every
//    registered profile phone for Extreme AMBER alerts.
// 2. Fallback: the device's own SMS composer, prefilled — works with no
//    gateway credit, over the sender's SIM.

export interface GatewayResult {
  ok: boolean;
  count: number;
  skipped?: boolean;
}

// Automatic SMS via the server-side Arkesel relay. Never throws.
export async function sendSmsViaGateway(
  kind: 'sos' | 'amber',
  message: string,
  recipients: string[] = []
): Promise<GatewayResult> {
  try {
    const token = await getAccessToken();
    if (!token) return { ok: false, count: 0 };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind, message, recipients }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.status === 'sent') return { ok: true, count: data.count ?? recipients.length };
    if (data?.status === 'skipped') return { ok: true, count: 0, skipped: true };
    return { ok: false, count: 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

export function sosMessage(name: string, center: LatLng, locationLabel: string): string {
  return (
    `🆘 SOS from ${name}! I need help. ` +
    `I'm near ${locationLabel}. Live location: https://maps.google.com/?q=${center.lat.toFixed(5)},${center.lon.toFixed(5)} ` +
    `— sent via SafeAlert`
  );
}

const cleanPhone = (p: string) => p.replace(/[^+\d]/g, '');

// Opens the device SMS composer prefilled (recipients + message).
// Returns false when no composer is available (e.g. desktop web).
export async function composeSms(contacts: EmergencyContact[], message: string): Promise<boolean> {
  const phones = contacts.map((c) => cleanPhone(c.phone)).filter(Boolean);
  if (phones.length === 0) return false;
  if (Platform.OS === 'web') {
    try {
      // works on mobile browsers; desktop has no SMS app
      await Linking.openURL(`sms:${phones.join(',')}?body=${encodeURIComponent(message)}`);
      return true;
    } catch {
      return false;
    }
  }
  try {
    if (!(await SMS.isAvailableAsync())) return false;
    await SMS.sendSMSAsync(phones, message);
    return true;
  } catch {
    return false;
  }
}
