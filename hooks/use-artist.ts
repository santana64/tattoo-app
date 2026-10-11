import { useCallback, useEffect, useState } from 'react';
import { fetchArtist } from '@/lib/catalog';
import type { Artist } from '@/constants/mock-data';

export function useArtist(id: string) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let active = true;
    setArtist(null); setLoading(true); setError(null);
    fetchArtist(id).then(data => { if (active) setArtist(data); })
      .catch(() => { if (active) setError('Impossible de charger cet artiste. Vérifiez votre connexion.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  return { artist, loading, error, retry };
}
