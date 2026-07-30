'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface AssetSparklineProps {
  data: { timestamp: string; price: number }[];
  changeDirection: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'lg';
}

export default function AssetSparkline({ data, changeDirection, size = 'sm' }: AssetSparklineProps) {
  const heightClass = size === 'lg' ? 'h-16' : 'h-8';
  if (!data || data.length === 0) {
    return (
      <div className={`w-full ${heightClass} flex items-center justify-center text-[var(--color-secondary)] text-xs font-mono`}>
        n/a
      </div>
    );
  }

  return (
    <div className={`w-full ${heightClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="price"
            stroke={changeDirection === 'up' ? 'var(--color-market-up)' : changeDirection === 'down' ? 'var(--color-market-down)' : 'var(--color-accent)'}
            strokeWidth={1}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
