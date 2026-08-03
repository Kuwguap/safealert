// Supabase REST backend — shared community store so alerts, SOS events and
// broadcasts reach every signed-in device, not just the one that sent them.
// The publishable key is safe to ship in the client; table access is limited
// by RLS policies (demo-permissive — lock down for production).

const SUPABASE_URL = 'https://vzrabcnknbycmdbmvdso.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rMz6Dp7xX9cYlz9x9ax79A_8OcwC4fY';

const HEADERS: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`backend ${res.status}: ${await res.text().catch(() => '')}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const backend = {
  select<T>(table: string, query: string): Promise<T[]> {
    return rest<T[]>(`${table}?${query}`);
  },
  insert<T>(table: string, row: object): Promise<T> {
    return rest<T[]>(table, {
      method: 'POST',
      body: JSON.stringify(row),
      headers: { Prefer: 'return=representation' },
    }).then((rows) => rows[0]);
  },
  delete(table: string, filter: string): Promise<void> {
    return rest<void>(`${table}?${filter}`, { method: 'DELETE' });
  },
  // reachability + latency for the admin smoke-test panel
  async ping(): Promise<{ ok: boolean; ms: number }> {
    const started = Date.now();
    try {
      await rest('safealert_bulletins?select=id&limit=1');
      return { ok: true, ms: Date.now() - started };
    } catch {
      return { ok: false, ms: Date.now() - started };
    }
  },
};
