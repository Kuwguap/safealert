import { getAccessToken, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

// Image uploads → Supabase Storage (public bucket `safealert-media`).
// Uploads go as raw JPEG bytes decoded from the picker's base64 — one code
// path that works on native and web alike.

const BUCKET = 'safealert-media';

function base64ToBytes(b64: string): Uint8Array {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i + 3 < clean.length || (i < clean.length && o < len); i += 4) {
    const n =
      (table.indexOf(clean[i]) << 18) |
      (table.indexOf(clean[i + 1]) << 12) |
      ((table.indexOf(clean[i + 2]) & 63) << 6) |
      (table.indexOf(clean[i + 3]) & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len) out[o++] = (n >> 8) & 255;
    if (o < len) out[o++] = n & 255;
  }
  return out;
}

export async function uploadImage(base64: string): Promise<string> {
  const token = (await getAccessToken()) ?? SUPABASE_ANON_KEY;
  const path = `alerts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const bytes = base64ToBytes(base64);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    },
    // RN + browsers both accept binary bodies; RN's fetch types just don't declare it
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`upload ${res.status}: ${await res.text().catch(() => '')}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
