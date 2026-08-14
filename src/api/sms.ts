import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';
import { EmergencyContact } from '../state/AuthContext';
import { LatLng } from '../util/geo';

// SOS text messages. There is no keyless server-side SMS gateway that
// delivers to Ghanaian numbers (Arkesel / Hubtel / mNotify / Twilio all need
// paid accounts), so the free channel that always works is the sender's own
// SIM: we open the native SMS composer prefilled with every emergency
// contact and the live-location link — one tap sends over the carrier to any
// Ghana number, no API, no cost beyond a normal SMS.
//
// To switch to server-side SMS later, get an API key from https://sms.arkesel.com
// (Ghanaian provider, has a free trial) and POST to
//   https://sms.arkesel.com/api/v2/sms/send
//   { "sender": "SafeAlert", "message": ..., "recipients": ["233..."] }
// with header "api-key" — slot it in below as the first attempt.

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
