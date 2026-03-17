import { Hono } from 'hono';
import {
  scanSubreddits,
  generateContent,
  postContent,
  trackEngagement,
  getConfig,
  getTargets,
  listContent,
} from '../core/engine';

export const jobs = new Hono();

// ─── Scan Job — every 30 min ───────────────────────────────────────

jobs.post('/scan', async (c) => {
  const config = await getConfig();
  if (!config.autoScan) return c.json({ skipped: true, reason: 'autoScan disabled' });

  const result = await scanSubreddits();
  console.log(`[scan] Scanned ${result.scanned} subreddits, found ${result.opportunities} opportunities`);
  return c.json({ ok: true, ...result });
});

// ─── Generate Job — every 2 hours ──────────────────────────────────

jobs.post('/generate', async (c) => {
  const config = await getConfig();
  if (!config.autoGenerate) return c.json({ skipped: true, reason: 'autoGenerate disabled' });

  const targets = await getTargets();
  const enabled = targets.filter(t => t.enabled);
  if (enabled.length === 0) return c.json({ skipped: true, reason: 'no enabled targets' });

  const generated: string[] = [];
  const count = Math.min(config.maxDraftsPerRun, enabled.length);

  for (let i = 0; i < count; i++) {
    const target = enabled[i % enabled.length];
    const keyword = config.keywords[Math.floor(Math.random() * config.keywords.length)];
    try {
      const item = await generateContent(keyword, target.name);
      generated.push(item.id);
    } catch (err) {
      console.error(`[generate] Failed for r/${target.name}:`, err);
    }
  }

  console.log(`[generate] Created ${generated.length} drafts`);
  return c.json({ ok: true, generated });
});

// ─── Post Job — every 4 hours ──────────────────────────────────────

jobs.post('/post', async (c) => {
  const config = await getConfig();
  if (!config.autoPost) return c.json({ skipped: true, reason: 'autoPost disabled' });

  const approved = await listContent('approved', 1);
  if (approved.length === 0) return c.json({ skipped: true, reason: 'no approved content' });

  const result = await postContent(approved[0].id);
  console.log(`[post] Posted ${approved[0].id}: ${result.ok ? 'success' : result.error}`);
  return c.json(result);
});

// ─── Track Job — every 1 hour ──────────────────────────────────────

jobs.post('/track', async (c) => {
  const result = await trackEngagement();
  console.log(`[track] Tracked ${result.tracked} posts, updated ${result.updated}`);
  return c.json({ ok: true, ...result });
});
