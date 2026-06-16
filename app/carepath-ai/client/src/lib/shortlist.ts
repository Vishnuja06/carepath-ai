// Client helpers for the Planner Workspace shortlist (persisted in Lakebase
// via /api/shortlist). Plain fetch + a tiny hook — no extra deps.
import { useCallback, useEffect, useState } from 'react';

export type ShortlistEntry = {
  id: number;
  facility_id: string;
  specialty: string | null;
  pincode: number | null;
  note: string | null;
  override_rank: number | null;
  created_at: string;
};

export type ShortlistInput = {
  facility_id: string;
  specialty?: string | null;
  pincode?: number | null;
  note?: string | null;
  override_rank?: number | null;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function useShortlist() {
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await getJson<ShortlistEntry[]>('/api/shortlist'));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: ShortlistInput) => {
      await fetch('/api/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      await fetch(`/api/shortlist/${id}`, { method: 'DELETE' });
      await refresh();
    },
    [refresh],
  );

  const savedIds = new Set(entries.map((e) => e.facility_id));

  return { entries, savedIds, loading, error, refresh, save, remove };
}
