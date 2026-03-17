import { redis, reddit } from '@devvit/web/server';
import type {
  ContentItem,
  EngineMetrics,
  EngineConfig,
  SubredditTarget,
} from '../../shared/types';
import { REDIS_KEYS, DEFAULT_CONFIG, DEFAULT_TARGETS } from '../../shared/types';

// ─── Config & Targets ──────────────────────────────────────────────

export async function getConfig(): Promise<EngineConfig> {
  const raw = await redis.get(REDIS_KEYS.config);
  return raw ? JSON.parse(raw) : DEFAULT_CONFIG;
}

export async function saveConfig(config: EngineConfig): Promise<void> {
  await redis.set(REDIS_KEYS.config, JSON.stringify(config));
}

export async function getTargets(): Promise<SubredditTarget[]> {
  const raw = await redis.get(REDIS_KEYS.targets);
  return raw ? JSON.parse(raw) : DEFAULT_TARGETS;
}

export async function saveTargets(targets: SubredditTarget[]): Promise<void> {
  await redis.set(REDIS_KEYS.targets, JSON.stringify(targets));
}

// ─── Content CRUD ──────────────────────────────────────────────────

export async function getContent(id: string): Promise<ContentItem | null> {
  const raw = await redis.get(REDIS_KEYS.content(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveContent(item: ContentItem): Promise<void> {
  await redis.set(REDIS_KEYS.content(item.id), JSON.stringify(item));
  const queueKey =
    item.status === 'draft'
      ? REDIS_KEYS.queueDraft
      : item.status === 'approved'
        ? REDIS_KEYS.queueApproved
        : item.status === 'posted'
          ? REDIS_KEYS.queuePosted
          : null;
  if (queueKey) {
    const score =
      item.status === 'posted'
        ? new Date(item.postedAt || item.createdAt).getTime()
        : new Date(item.createdAt).getTime();
    await redis.zAdd(queueKey, { member: item.id, score });
  }
}

export async function listContent(
  status?: string,
  limit = 50
): Promise<ContentItem[]> {
  let ids: string[];
  if (status === 'draft') {
    ids = (await redis.zRange(REDIS_KEYS.queueDraft, 0, limit - 1, { reverse: true })).map(e => e.member);
  } else if (status === 'approved') {
    ids = (await redis.zRange(REDIS_KEYS.queueApproved, 0, limit - 1, { reverse: true })).map(e => e.member);
  } else if (status === 'posted') {
    ids = (await redis.zRange(REDIS_KEYS.queuePosted, 0, limit - 1, { reverse: true })).map(e => e.member);
  } else {
    // Get from all queues
    const [drafts, approved, posted] = await Promise.all([
      redis.zRange(REDIS_KEYS.queueDraft, 0, limit - 1, { reverse: true }),
      redis.zRange(REDIS_KEYS.queueApproved, 0, limit - 1, { reverse: true }),
      redis.zRange(REDIS_KEYS.queuePosted, 0, limit - 1, { reverse: true }),
    ]);
    ids = [...drafts, ...approved, ...posted]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(e => e.member);
  }

  const items: ContentItem[] = [];
  for (const id of ids) {
    const item = await getContent(id);
    if (item) items.push(item);
  }
  return items;
}

// ─── Scan Subreddits ───────────────────────────────────────────────

export async function scanSubreddits(): Promise<{
  scanned: number;
  opportunities: number;
}> {
  const targets = await getTargets();
  const config = await getConfig();
  const enabled = targets.filter(t => t.enabled);
  let opportunities = 0;

  for (const target of enabled) {
    try {
      const posts = await reddit.getHotPosts({
        subredditName: target.name,
        limit: 25,
      });

      for (const post of posts) {
        const text = `${post.title} ${post.body || ''}`.toLowerCase();
        const matched = config.keywords.some(kw => text.includes(kw.toLowerCase()));
        if (matched) {
          // Store opportunity as a lightweight key
          await redis.set(
            `opportunity:${post.id}`,
            JSON.stringify({
              id: post.id,
              subreddit: target.name,
              title: post.title,
              score: post.score,
              numComments: post.numberOfComments,
              url: post.url,
              foundAt: new Date().toISOString(),
            }),
            { expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // 7 day TTL
          );
          opportunities++;
        }
      }
    } catch (err) {
      console.error(`Scan failed for r/${target.name}:`, err);
    }
  }

  await redis.set(REDIS_KEYS.scanLast, new Date().toISOString());
  return { scanned: enabled.length, opportunities };
}

// ─── Generate Content ──────────────────────────────────────────────

export async function generateContent(
  topic: string,
  subreddit: string
): Promise<ContentItem> {
  const target = (await getTargets()).find(t => t.name === subreddit);
  const tone = target?.tonePreference || 'conversational';

  let title = '';
  let body = '';

  try {
    // Call 0nmcp.com AI endpoint for content generation
    const res = await fetch('https://0nmcp.com/api/reddit/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, subreddit, tone }),
    });

    if (res.ok) {
      const data = await res.json();
      title = data.title || topic;
      body = data.body || `Discussion about ${topic} in the context of AI orchestration and workflow automation.`;
    } else {
      // Fallback: generate locally
      title = `${topic} — How AI Orchestration Changes the Game`;
      body = [
        `Been exploring ${topic} lately and wanted to share some thoughts with r/${subreddit}.`,
        '',
        `The rise of MCP (Model Context Protocol) is making it possible to connect AI models to any API without writing custom integration code. Tools like 0nMCP let you orchestrate 500+ tools across 26 services from a single interface.`,
        '',
        `Key takeaway: instead of building workflows manually, you describe outcomes and let the AI figure out the steps.`,
        '',
        `What's everyone's experience been with AI-driven automation? Curious to hear different perspectives.`,
      ].join('\n');
    }
  } catch {
    title = `${topic} — How AI Orchestration Changes the Game`;
    body = `Discussion about ${topic} and the future of AI-driven workflow automation. The MCP protocol is enabling a new wave of tools that can orchestrate hundreds of APIs from a single interface.\n\nWhat are your thoughts on this direction?`;
  }

  const id = `content_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: ContentItem = {
    id,
    title,
    body,
    subreddit,
    contentType: 'post',
    tone,
    status: 'draft',
    source: 'ai',
    createdAt: new Date().toISOString(),
  };

  await saveContent(item);
  return item;
}

// ─── Post Content ──────────────────────────────────────────────────

export async function postContent(
  contentId: string
): Promise<{ ok: boolean; redditPostId?: string; error?: string }> {
  const item = await getContent(contentId);
  if (!item) return { ok: false, error: 'Content not found' };
  if (item.status !== 'approved') return { ok: false, error: 'Content must be approved before posting' };

  try {
    const post = await reddit.submitPost({
      subredditName: item.subreddit,
      title: item.title,
      text: item.body,
    });

    // Remove from approved queue
    await redis.zRem(REDIS_KEYS.queueApproved, [item.id]);

    // Update item
    item.status = 'posted';
    item.redditPostId = post.id;
    item.postedAt = new Date().toISOString();
    await saveContent(item);

    // Update metrics
    await incrementMetric('totalPosted');

    return { ok: true, redditPostId: post.id };
  } catch (err) {
    item.status = 'failed';
    await saveContent(item);
    return { ok: false, error: err instanceof Error ? err.message : 'Post failed' };
  }
}

// ─── Approve Content ───────────────────────────────────────────────

export async function approveContent(
  contentId: string
): Promise<{ ok: boolean; error?: string }> {
  const item = await getContent(contentId);
  if (!item) return { ok: false, error: 'Content not found' };

  // Remove from draft queue
  await redis.zRem(REDIS_KEYS.queueDraft, [item.id]);

  item.status = 'approved';
  await saveContent(item);
  return { ok: true };
}

// ─── Track Engagement ──────────────────────────────────────────────

export async function trackEngagement(): Promise<{
  tracked: number;
  updated: number;
}> {
  const posted = await listContent('posted', 100);
  let updated = 0;

  for (const item of posted) {
    if (!item.redditPostId) continue;
    try {
      const post = await reddit.getPostById(item.redditPostId);
      if (post) {
        const changed =
          item.score !== post.score ||
          item.comments !== post.numberOfComments;
        if (changed) {
          item.score = post.score;
          item.comments = post.numberOfComments;
          await redis.set(REDIS_KEYS.content(item.id), JSON.stringify(item));
          updated++;
        }
      }
    } catch (err) {
      console.error(`Track failed for ${item.redditPostId}:`, err);
    }
  }

  // Recalculate global metrics
  await recalculateMetrics();
  return { tracked: posted.length, updated };
}

// ─── Metrics ───────────────────────────────────────────────────────

export async function getMetrics(): Promise<EngineMetrics> {
  const raw = await redis.get(REDIS_KEYS.metricsGlobal);
  if (raw) return JSON.parse(raw);
  return {
    totalGenerated: 0,
    totalPosted: 0,
    totalUpvotes: 0,
    totalComments: 0,
    avgScore: 0,
    topSubreddits: [],
  };
}

async function incrementMetric(
  field: 'totalGenerated' | 'totalPosted'
): Promise<void> {
  const metrics = await getMetrics();
  metrics[field]++;
  await redis.set(REDIS_KEYS.metricsGlobal, JSON.stringify(metrics));
}

async function recalculateMetrics(): Promise<void> {
  const posted = await listContent('posted', 500);
  const subredditMap = new Map<string, { count: number; totalScore: number }>();

  let totalUpvotes = 0;
  let totalComments = 0;

  for (const item of posted) {
    totalUpvotes += item.score || 0;
    totalComments += item.comments || 0;

    const entry = subredditMap.get(item.subreddit) || { count: 0, totalScore: 0 };
    entry.count++;
    entry.totalScore += item.score || 0;
    subredditMap.set(item.subreddit, entry);
  }

  const allContent = await listContent(undefined, 1000);

  const metrics: EngineMetrics = {
    totalGenerated: allContent.length,
    totalPosted: posted.length,
    totalUpvotes,
    totalComments,
    avgScore: posted.length > 0 ? Math.round(totalUpvotes / posted.length) : 0,
    topSubreddits: Array.from(subredditMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };

  await redis.set(REDIS_KEYS.metricsGlobal, JSON.stringify(metrics));
}

// ─── Delete Content ────────────────────────────────────────────────

export async function deleteContent(
  contentId: string
): Promise<{ ok: boolean; error?: string }> {
  const item = await getContent(contentId);
  if (!item) return { ok: false, error: 'Content not found' };

  await redis.del(REDIS_KEYS.content(contentId));
  await redis.zRem(REDIS_KEYS.queueDraft, [contentId]);
  await redis.zRem(REDIS_KEYS.queueApproved, [contentId]);
  await redis.zRem(REDIS_KEYS.queuePosted, [contentId]);

  return { ok: true };
}
