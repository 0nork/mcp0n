import { Hono } from 'hono';
import {
  getMetrics,
  getConfig,
  saveConfig,
  getTargets,
  saveTargets,
  listContent,
  saveContent,
  generateContent,
  postContent,
  approveContent,
  deleteContent,
  scanSubreddits,
  trackEngagement,
} from '../core/engine';
import type { ContentItem, DashboardResponse } from '../../shared/types';

export const engine = new Hono();

// ─── Dashboard ─────────────────────────────────────────────────────

engine.get('/dashboard', async (c) => {
  const [metrics, recentContent, config, targets] = await Promise.all([
    getMetrics(),
    listContent(undefined, 20),
    getConfig(),
    getTargets(),
  ]);

  return c.json<DashboardResponse>({
    metrics,
    recentContent,
    config,
    targets,
    nextScan: null,
    nextPost: null,
    engineRunning: config.autoScan || config.autoGenerate || config.autoPost,
  });
});

// ─── Content List ──────────────────────────────────────────────────

engine.get('/content', async (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  const items = await listContent(status, limit);
  return c.json({ items, total: items.length });
});

// ─── Create Manual Content ─────────────────────────────────────────

engine.post('/content', async (c) => {
  const body = await c.req.json<{
    title: string;
    body: string;
    subreddit: string;
    contentType?: 'post' | 'comment';
  }>();

  const id = `content_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: ContentItem = {
    id,
    title: body.title,
    body: body.body,
    subreddit: body.subreddit,
    contentType: body.contentType || 'post',
    tone: 'manual',
    status: 'draft',
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  await saveContent(item);
  return c.json({ ok: true, item });
});

// ─── AI Generate ───────────────────────────────────────────────────

engine.post('/generate', async (c) => {
  const { topic, subreddit } = await c.req.json<{
    topic: string;
    subreddit: string;
  }>();

  const item = await generateContent(topic, subreddit);
  return c.json({ ok: true, item });
});

// ─── Approve ───────────────────────────────────────────────────────

engine.post('/approve/:id', async (c) => {
  const result = await approveContent(c.req.param('id'));
  return c.json(result);
});

// ─── Post Now ──────────────────────────────────────────────────────

engine.post('/post/:id', async (c) => {
  const result = await postContent(c.req.param('id'));
  return c.json(result);
});

// ─── Delete ────────────────────────────────────────────────────────

engine.delete('/content/:id', async (c) => {
  const result = await deleteContent(c.req.param('id'));
  return c.json(result);
});

// ─── Targets ───────────────────────────────────────────────────────

engine.get('/targets', async (c) => {
  const targets = await getTargets();
  return c.json({ targets });
});

engine.put('/targets', async (c) => {
  const { targets } = await c.req.json<{
    targets: import('../../shared/types').SubredditTarget[];
  }>();
  await saveTargets(targets);
  return c.json({ ok: true, targets });
});

// ─── Config ────────────────────────────────────────────────────────

engine.get('/config', async (c) => {
  const config = await getConfig();
  return c.json({ config });
});

engine.put('/config', async (c) => {
  const { config } = await c.req.json<{
    config: import('../../shared/types').EngineConfig;
  }>();
  await saveConfig(config);
  return c.json({ ok: true, config });
});

// ─── Manual Full Pipeline ──────────────────────────────────────────

engine.post('/run', async (c) => {
  const results: Record<string, unknown> = {};

  // 1. Scan
  results.scan = await scanSubreddits();

  // 2. Generate from first enabled target
  const targets = await getTargets();
  const enabled = targets.filter(t => t.enabled);
  if (enabled.length > 0) {
    const target = enabled[Math.floor(Math.random() * enabled.length)];
    const config = await getConfig();
    const keyword = config.keywords[Math.floor(Math.random() * config.keywords.length)];
    results.generate = await generateContent(keyword, target.name);
  }

  // 3. Track posted items
  results.track = await trackEngagement();

  return c.json({ ok: true, results });
});
