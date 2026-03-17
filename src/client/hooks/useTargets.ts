import { useCallback, useEffect, useState } from 'react';
import type { SubredditTarget } from '../../shared/types';

export const useTargets = () => {
  const [targets, setTargets] = useState<SubredditTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/engine/targets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTargets(data.targets || []);
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTargets = useCallback(async (updated: SubredditTarget[]) => {
    try {
      await fetch('/api/engine/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: updated }),
      });
      setTargets(updated);
    } catch (err) {
      console.error('Failed to save targets:', err);
    }
  }, []);

  const toggleTarget = useCallback(
    (name: string) => {
      const updated = targets.map((t) =>
        t.name === name ? { ...t, enabled: !t.enabled } : t
      );
      saveTargets(updated);
    },
    [targets, saveTargets]
  );

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  return { targets, loading, saveTargets, toggleTarget } as const;
};
