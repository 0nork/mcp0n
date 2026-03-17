// mcp0n Growth Engine — shared types

export type ContentItem = {
  id: string;
  title: string;
  body: string;
  subreddit: string;
  contentType: 'post' | 'comment';
  tone: string;
  status: 'draft' | 'approved' | 'posted' | 'failed';
  source: 'ai' | 'manual' | 'forum-copy';
  redditPostId?: string;
  score?: number;
  comments?: number;
  createdAt: string;
  postedAt?: string;
};

export type EngineMetrics = {
  totalGenerated: number;
  totalPosted: number;
  totalUpvotes: number;
  totalComments: number;
  avgScore: number;
  topSubreddits: { name: string; count: number; avgScore: number }[];
};

export type SubredditTarget = {
  name: string;
  contentTypes: string[];
  tonePreference: string;
  postFrequency: string;
  enabled: boolean;
};

export type EngineConfig = {
  autoScan: boolean;
  autoGenerate: boolean;
  autoPost: boolean;
  scanIntervalMinutes: number;
  generateIntervalHours: number;
  postIntervalHours: number;
  trackIntervalHours: number;
  keywords: string[];
  maxDraftsPerRun: number;
  maxPostsPerDay: number;
};

export type DashboardResponse = {
  metrics: EngineMetrics;
  recentContent: ContentItem[];
  config: EngineConfig;
  targets: SubredditTarget[];
  nextScan: string | null;
  nextPost: string | null;
  engineRunning: boolean;
};

// Redis key schema constants
export const REDIS_KEYS = {
  content: (id: string) => `content:${id}`,
  queueDraft: 'content:queue:draft',
  queueApproved: 'content:queue:approved',
  queuePosted: 'content:queue:posted',
  metricsGlobal: 'metrics:global',
  metricsSubreddit: (name: string) => `metrics:subreddit:${name}`,
  targets: 'targets',
  config: 'config',
  scanLast: 'scan:last',
} as const;

// Default engine config
export const DEFAULT_CONFIG: EngineConfig = {
  autoScan: true,
  autoGenerate: true,
  autoPost: false,
  scanIntervalMinutes: 30,
  generateIntervalHours: 2,
  postIntervalHours: 4,
  trackIntervalHours: 1,
  keywords: ['AI', 'automation', 'MCP', 'workflow', 'API', 'orchestration', 'LLM', 'agent'],
  maxDraftsPerRun: 3,
  maxPostsPerDay: 5,
};

// Default subreddit targets
export const DEFAULT_TARGETS: SubredditTarget[] = [
  { name: 'artificial', contentTypes: ['post'], tonePreference: 'technical', postFrequency: 'daily', enabled: true },
  { name: 'automation', contentTypes: ['post', 'comment'], tonePreference: 'practical', postFrequency: 'daily', enabled: true },
  { name: 'LocalLLaMA', contentTypes: ['post', 'comment'], tonePreference: 'technical', postFrequency: 'weekly', enabled: true },
  { name: 'MachineLearning', contentTypes: ['post'], tonePreference: 'academic', postFrequency: 'weekly', enabled: true },
  { name: 'singularity', contentTypes: ['post'], tonePreference: 'conversational', postFrequency: 'weekly', enabled: false },
  { name: 'SaaS', contentTypes: ['post', 'comment'], tonePreference: 'business', postFrequency: 'weekly', enabled: false },
];
