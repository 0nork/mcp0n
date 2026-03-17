import './index.css';

import { requestExpandedMode, navigateTo } from '@devvit/web/client';
import { context } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

type SplashMetrics = {
  generated: number;
  posted: number;
  upvotes: number;
  avgScore: number;
};

export const Splash = () => {
  const [metrics, setMetrics] = useState<SplashMetrics | null>(null);

  useEffect(() => {
    fetch('/api/engine/dashboard')
      .then((r) => r.json())
      .then((data) => {
        setMetrics({
          generated: data.metrics?.totalGenerated || 0,
          posted: data.metrics?.totalPosted || 0,
          upvotes: data.metrics?.totalUpvotes || 0,
          avgScore: data.metrics?.avgScore || 0,
        });
      })
      .catch(() => setMetrics({ generated: 0, posted: 0, upvotes: 0, avgScore: 0 }));
  }, []);

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4 bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-1">
        <div className="text-[#7ed957] text-3xl font-bold tracking-tight">
          mcp0n
        </div>
        <div className="text-xs text-gray-500 font-mono">Growth Engine</div>
      </div>

      <div className="text-sm text-gray-400 text-center">
        Hey {context.username ?? 'user'}
      </div>

      {metrics && (
        <div className="grid grid-cols-4 gap-3 w-full max-w-[380px] px-4">
          <KPI label="Generated" value={metrics.generated} />
          <KPI label="Live" value={metrics.posted} />
          <KPI label="Upvotes" value={metrics.upvotes} />
          <KPI label="Avg Score" value={metrics.avgScore} />
        </div>
      )}

      <button
        className="mt-2 px-6 py-2.5 bg-[#7ed957] text-[#0a0a0a] font-semibold text-sm rounded-full cursor-pointer transition-all hover:bg-[#5cb83a] hover:shadow-[0_0_20px_rgba(126,217,87,0.3)]"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Open Dashboard
      </button>

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.75em] text-gray-600">
        <button
          className="cursor-pointer hover:text-[#7ed957] transition-colors"
          onClick={() => navigateTo('https://0nmcp.com')}
        >
          0nmcp.com
        </button>
        <span className="text-gray-700">|</span>
        <button
          className="cursor-pointer hover:text-[#7ed957] transition-colors"
          onClick={() => navigateTo('https://github.com/0nork/0nmcp')}
        >
          GitHub
        </button>
      </footer>
    </div>
  );
};

const KPI = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center gap-0.5 bg-[#111] border border-[#222] rounded-lg p-2">
    <div className="text-lg font-bold text-[#7ed957] font-mono">{value}</div>
    <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
