import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostCreateRequest,
  OnCommentCreateRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context, redis, scheduler } from '@devvit/web/server';
import { createPost } from '../core/post';
import { DEFAULT_CONFIG, DEFAULT_TARGETS } from '../../shared/types';

export const triggers = new Hono();

// ─── App Install — create post + schedule jobs ─────────────────────

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    // Initialize default config and targets in Redis
    await redis.set('config', JSON.stringify(DEFAULT_CONFIG));
    await redis.set('targets', JSON.stringify(DEFAULT_TARGETS));

    // Schedule cron jobs
    await scheduler.runJob({ name: 'scan', cron: '*/30 * * * *' });
    await scheduler.runJob({ name: 'generate', cron: '0 */2 * * *' });
    await scheduler.runJob({ name: 'post', cron: '0 */4 * * *' });
    await scheduler.runJob({ name: 'track', cron: '0 * * * *' });

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `mcp0n installed in r/${context.subredditName} — post ${post.id}, 4 jobs scheduled (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`Error during app install: ${error}`);
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to initialize mcp0n',
      },
      400
    );
  }
});

// ─── Post Create — track our posts ─────────────────────────────────

triggers.post('/on-post-create', async (c) => {
  try {
    const input = await c.req.json<OnPostCreateRequest>();
    const postId = input.post?.id;

    if (postId) {
      const raw = await redis.get(`tracking:${postId}`);
      if (!raw) {
        await redis.set(
          `tracking:${postId}`,
          JSON.stringify({ postId, trackedAt: new Date().toISOString() }),
          { expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        );
      }
    }

    return c.json<TriggerResponse>({ status: 'success', message: 'Post tracked' }, 200);
  } catch (error) {
    console.error(`onPostCreate error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Track failed' }, 400);
  }
});

// ─── Comment Create — increment engagement ─────────────────────────

triggers.post('/on-comment-create', async (c) => {
  try {
    const input = await c.req.json<OnCommentCreateRequest>();
    const postId = input.comment?.postId;

    if (postId) {
      const tracked = await redis.get(`tracking:${postId}`);
      if (tracked) {
        await redis.incrBy(`engagement:comments:${postId}`, 1);
      }
    }

    return c.json<TriggerResponse>({ status: 'success', message: 'Comment tracked' }, 200);
  } catch (error) {
    console.error(`onCommentCreate error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Track failed' }, 400);
  }
});
