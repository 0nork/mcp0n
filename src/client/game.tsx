import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useEngine } from './hooks/useEngine';
import { useTargets } from './hooks/useTargets';
import type { ContentItem } from '../shared/types';

// ─── Main Dashboard ────────────────────────────────────────────────

const Dashboard = () => {
  const {
    metrics,
    content,
    targets: engineTargets,
    engineRunning,
    loading,
    actionLoading,
    statusFilter,
    generatePost,
    approveItem,
    postItem,
    deleteItem,
    runPipeline,
    filterByStatus,
  } = useEngine();

  const { targets, toggleTarget } = useTargets();

  const [genTopic, setGenTopic] = useState('');
  const [genSubreddit, setGenSubreddit] = useState('');
  const [showGenForm, setShowGenForm] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-[#7ed957] font-mono text-sm animate-pulse">
          Loading mcp0n...
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!genTopic || !genSubreddit) return;
    await generatePost(genTopic, genSubreddit);
    setGenTopic('');
    setShowGenForm(false);
  };

  const enabledTargets = (targets.length > 0 ? targets : engineTargets).filter(
    (t) => t.enabled
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#7ed957]">
            mcp0n Growth Engine
          </h1>
          <div className="text-xs text-gray-500 font-mono">
            Reddit content pipeline
          </div>
        </div>
        <div
          className={`text-xs font-mono px-2 py-1 rounded-full border ${
            engineRunning
              ? 'text-[#7ed957] border-[#7ed957]/30 bg-[#7ed957]/10'
              : 'text-gray-500 border-gray-700 bg-gray-800'
          }`}
        >
          {engineRunning ? 'Running' : 'Paused'}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <KPICard
          label="Generated"
          value={metrics.totalGenerated}
          color="#7ed957"
        />
        <KPICard label="Live" value={metrics.totalPosted} color="#00d4ff" />
        <KPICard
          label="Engagement"
          value={metrics.totalUpvotes + metrics.totalComments}
          color="#a78bfa"
        />
        <KPICard
          label="Avg Score"
          value={metrics.avgScore}
          color="#f59e0b"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          className="px-3 py-1.5 text-xs font-medium rounded bg-[#7ed957]/10 text-[#7ed957] border border-[#7ed957]/30 hover:bg-[#7ed957]/20 transition-colors disabled:opacity-50"
          onClick={() => setShowGenForm(!showGenForm)}
        >
          Generate Post
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/30 hover:bg-[#a78bfa]/20 transition-colors disabled:opacity-50"
          onClick={() => runPipeline()}
          disabled={actionLoading === 'pipeline'}
        >
          {actionLoading === 'pipeline' ? 'Running...' : 'Run Full Pipeline'}
        </button>
      </div>

      {/* Generate Form */}
      {showGenForm && (
        <div className="bg-[#111] border border-[#222] rounded-lg p-3 mb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                Topic
              </label>
              <input
                type="text"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. AI workflow automation"
                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-xs text-[#e5e5e5] focus:border-[#7ed957] focus:outline-none"
              />
            </div>
            <div className="w-36">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
                Subreddit
              </label>
              <select
                value={genSubreddit}
                onChange={(e) => setGenSubreddit(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded px-2 py-1.5 text-xs text-[#e5e5e5] focus:border-[#7ed957] focus:outline-none"
              >
                <option value="">Select...</option>
                {enabledTargets.map((t) => (
                  <option key={t.name} value={t.name}>
                    r/{t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="px-3 py-1.5 text-xs font-medium rounded bg-[#7ed957] text-[#0a0a0a] hover:bg-[#5cb83a] transition-colors disabled:opacity-50"
              onClick={handleGenerate}
              disabled={
                !genTopic || !genSubreddit || actionLoading === 'generate'
              }
            >
              {actionLoading === 'generate' ? '...' : 'Go'}
            </button>
          </div>
        </div>
      )}

      {/* Content Pipeline */}
      <div className="bg-[#111] border border-[#222] rounded-lg mb-4">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <h2 className="text-sm font-semibold">Content Pipeline</h2>
        </div>
        <div className="flex gap-1 px-3 pb-2">
          {[
            { label: 'All', value: undefined },
            { label: 'Drafts', value: 'draft' },
            { label: 'Approved', value: 'approved' },
            { label: 'Posted', value: 'posted' },
          ].map((tab) => (
            <button
              key={tab.label}
              className={`px-2.5 py-1 text-[10px] rounded font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[#7ed957]/20 text-[#7ed957]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => filterByStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {content.length === 0 ? (
          <div className="px-3 pb-4 text-xs text-gray-600 text-center py-8">
            No content yet. Generate your first post above.
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {content.map((item) => (
              <ContentRow
                key={item.id}
                item={item}
                actionLoading={actionLoading}
                onApprove={() => approveItem(item.id)}
                onPost={() => postItem(item.id)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Target Subreddits */}
      <div className="bg-[#111] border border-[#222] rounded-lg mb-4">
        <div className="px-3 pt-3 pb-2">
          <h2 className="text-sm font-semibold">Target Subreddits</h2>
        </div>
        <div className="px-3 pb-3">
          {(targets.length > 0 ? targets : engineTargets).map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0"
            >
              <div className="flex items-center gap-2">
                <button
                  className={`w-7 h-4 rounded-full transition-colors relative ${
                    t.enabled ? 'bg-[#7ed957]' : 'bg-gray-700'
                  }`}
                  onClick={() => toggleTarget(t.name)}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                      t.enabled ? 'left-3.5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-mono">r/{t.name}</span>
              </div>
              <span className="text-[10px] text-gray-500">
                {t.tonePreference}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Subreddits Performance */}
      {metrics.topSubreddits.length > 0 && (
        <div className="bg-[#111] border border-[#222] rounded-lg">
          <div className="px-3 pt-3 pb-2">
            <h2 className="text-sm font-semibold">Top Performing</h2>
          </div>
          <div className="px-3 pb-3">
            {metrics.topSubreddits.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0"
              >
                <span className="text-xs font-mono">r/{s.name}</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-gray-500">
                    {s.count} post{s.count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[#7ed957] font-mono">
                    avg {s.avgScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Components ────────────────────────────────────────────────────

const KPICard = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <div className="bg-[#111] border border-[#222] rounded-lg p-2.5 text-center">
    <div className="text-xl font-bold font-mono" style={{ color }}>
      {value}
    </div>
    <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
      {label}
    </div>
  </div>
);

const statusColors: Record<string, string> = {
  draft: '#f59e0b',
  approved: '#00d4ff',
  posted: '#7ed957',
  failed: '#ef4444',
};

const ContentRow = ({
  item,
  actionLoading,
  onApprove,
  onPost,
  onDelete,
}: {
  item: ContentItem;
  actionLoading: string | null;
  onApprove: () => void;
  onPost: () => void;
  onDelete: () => void;
}) => {
  const isLoading = actionLoading === item.id;
  const statusColor = statusColors[item.status] || '#888';

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
      <span
        className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded"
        style={{
          color: statusColor,
          backgroundColor: `${statusColor}15`,
          border: `1px solid ${statusColor}30`,
        }}
      >
        {item.status}
      </span>
      <span className="text-[10px] text-gray-500 font-mono w-20 shrink-0">
        r/{item.subreddit}
      </span>
      <span className="text-xs flex-1 truncate">{item.title}</span>
      {item.score !== undefined && item.status === 'posted' && (
        <span className="text-[10px] text-[#7ed957] font-mono">
          {item.score}
        </span>
      )}
      <div className="flex gap-1 shrink-0">
        {item.status === 'draft' && (
          <button
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 disabled:opacity-50"
            onClick={onApprove}
            disabled={isLoading}
          >
            Approve
          </button>
        )}
        {item.status === 'approved' && (
          <button
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#7ed957]/10 text-[#7ed957] border border-[#7ed957]/30 hover:bg-[#7ed957]/20 disabled:opacity-50"
            onClick={onPost}
            disabled={isLoading}
          >
            Post
          </button>
        )}
        {item.status !== 'posted' && (
          <button
            className="text-[10px] px-1.5 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/20 disabled:opacity-50"
            onClick={onDelete}
            disabled={isLoading}
          >
            X
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Mount ─────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>
);
