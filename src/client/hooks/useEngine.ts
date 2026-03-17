import { useCallback, useEffect, useState } from 'react';
import type {
  ContentItem,
  EngineMetrics,
  EngineConfig,
  SubredditTarget,
} from '../../shared/types';

interface EngineState {
  metrics: EngineMetrics;
  content: ContentItem[];
  config: EngineConfig;
  targets: SubredditTarget[];
  engineRunning: boolean;
  loading: boolean;
}

const emptyMetrics: EngineMetrics = {
  totalGenerated: 0,
  totalPosted: 0,
  totalUpvotes: 0,
  totalComments: 0,
  avgScore: 0,
  topSubreddits: [],
};

export const useEngine = () => {
  const [state, setState] = useState<EngineState>({
    metrics: emptyMetrics,
    content: [],
    config: {} as EngineConfig,
    targets: [],
    engineRunning: false,
    loading: true,
  });
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/engine/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({
        metrics: data.metrics || emptyMetrics,
        content: data.recentContent || [],
        config: data.config || {},
        targets: data.targets || [],
        engineRunning: data.engineRunning || false,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const loadContent = useCallback(async (status?: string) => {
    try {
      const url = status
        ? `/api/engine/content?status=${status}`
        : '/api/engine/content';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState((prev) => ({ ...prev, content: data.items || [] }));
    } catch (err) {
      console.error('Failed to load content:', err);
    }
  }, []);

  const generatePost = useCallback(
    async (topic: string, subreddit: string) => {
      setActionLoading('generate');
      try {
        const res = await fetch('/api/engine/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, subreddit }),
        });
        const data = await res.json();
        await loadDashboard();
        return data;
      } finally {
        setActionLoading(null);
      }
    },
    [loadDashboard]
  );

  const approveItem = useCallback(
    async (id: string) => {
      setActionLoading(id);
      try {
        await fetch(`/api/engine/approve/${id}`, { method: 'POST' });
        await loadContent(statusFilter);
      } finally {
        setActionLoading(null);
      }
    },
    [loadContent, statusFilter]
  );

  const postItem = useCallback(
    async (id: string) => {
      setActionLoading(id);
      try {
        const res = await fetch(`/api/engine/post/${id}`, { method: 'POST' });
        const data = await res.json();
        await loadDashboard();
        return data;
      } finally {
        setActionLoading(null);
      }
    },
    [loadDashboard]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      setActionLoading(id);
      try {
        await fetch(`/api/engine/content/${id}`, { method: 'DELETE' });
        await loadContent(statusFilter);
      } finally {
        setActionLoading(null);
      }
    },
    [loadContent, statusFilter]
  );

  const runPipeline = useCallback(async () => {
    setActionLoading('pipeline');
    try {
      const res = await fetch('/api/engine/run', { method: 'POST' });
      const data = await res.json();
      await loadDashboard();
      return data;
    } finally {
      setActionLoading(null);
    }
  }, [loadDashboard]);

  const filterByStatus = useCallback(
    (status?: string) => {
      setStatusFilter(status);
      loadContent(status);
    },
    [loadContent]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return {
    ...state,
    actionLoading,
    statusFilter,
    loadDashboard,
    loadContent,
    generatePost,
    approveItem,
    postItem,
    deleteItem,
    runPipeline,
    filterByStatus,
  } as const;
};
