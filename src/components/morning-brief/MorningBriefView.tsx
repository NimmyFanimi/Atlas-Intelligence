'use client';

import React from 'react';

export interface MoverEntry {
  symbol: string;
  name: string;
  change_pct: number;
}

export interface BriefMovers {
  gainers: MoverEntry[];
  losers: MoverEntry[];
}

export interface MorningBriefData {
  brief_date: string;
  content: string;
  movers_data: BriefMovers;
  generated_at: string;
}

export interface TodayEvent {
  event_name: string;
  release_time: string | null;
}

interface MorningBriefViewProps {
  brief: MorningBriefData | null;
  todayEvents: TodayEvent[];
  referenceDate: string;
}

const CUTOFF_TIME = '06:00';

function formatBriefDate(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(date);
  const day = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const month = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  return `${weekday}, ${day} ${month}`;
}

function formatEventTime(time: string | null) {
  return time ? time.slice(0, 5) : '';
}

function formatChange(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function MoverColumn({
  label,
  tone,
  movers,
}: {
  label: string;
  tone: 'up' | 'down';
  movers: MoverEntry[];
}) {
  return (
    <div className="px-[18px] py-4">
      <div
        className={`font-mono text-[10px] font-semibold tracking-[0.1em] uppercase mb-3 ${
          tone === 'up'
            ? 'text-[var(--color-market-up)]'
            : 'text-[var(--color-market-down)]'
        }`}
      >
        {label}
      </div>
      {movers.length === 0 ? (
        <div className="text-xs italic text-[var(--color-secondary)]/50">
          No {label.toLowerCase()}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {movers.map((mover) => (
            <div
              key={`${mover.symbol}-${mover.change_pct}`}
              className="flex justify-between items-center py-[7px]"
            >
              <span className="text-[12.5px] font-medium text-[var(--color-primary)]">
                {mover.name || mover.symbol}
              </span>
              <span
                className={`font-mono text-[12.5px] font-semibold px-1.5 py-0.5 ${
                  tone === 'up'
                    ? 'text-[var(--color-market-up)] bg-[var(--color-market-up)]/12'
                    : 'text-[var(--color-market-down)] bg-[var(--color-market-down)]/12'
                }`}
              >
                {formatChange(mover.change_pct)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MorningBriefView({
  brief,
  todayEvents,
  referenceDate,
}: MorningBriefViewProps) {
  const paragraphs = brief
    ? brief.content
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
  const gainers = brief?.movers_data?.gainers ?? [];
  const losers = brief?.movers_data?.losers ?? [];

  return (
    <div className="p-9 max-w-[720px] mx-auto">
      {/* Header */}
      <div className="flex flex-col items-start gap-3.5 pb-5 border-b border-[var(--color-border)] mb-7 sm:flex-row sm:justify-between sm:items-baseline">
        <div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-accent)]">
            Morning Brief
          </div>
          <div className="text-2xl font-semibold tracking-[-0.01em] mt-1.5 text-[var(--color-primary)]">
            {formatBriefDate(referenceDate)}
          </div>
        </div>
        <div className="font-mono text-[11px] leading-[1.6] text-left sm:text-right">
          <div className="text-[var(--color-secondary)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mr-1.5 align-middle" />
            Prepared by Atlas
          </div>
          <div className="text-[var(--color-secondary)]/60">Data cutoff {CUTOFF_TIME} UTC</div>
        </div>
      </div>

      {/* Today strip */}
      <div className="flex items-center gap-3.5 px-3.5 py-2.5 border border-[var(--color-border)] bg-[var(--color-surface)] mb-7 overflow-x-auto">
        <div className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-secondary)]/60 flex-shrink-0 whitespace-nowrap">
          Today
        </div>
        {todayEvents.length === 0 ? (
          <div className="text-xs italic text-[var(--color-secondary)]/60">
            No confirmed events today
          </div>
        ) : (
          <div className="flex items-center gap-[18px] flex-wrap">
            {todayEvents.map((event, idx) => (
              <div key={idx} className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="font-mono text-xs text-[var(--color-accent)]">
                  {formatEventTime(event.release_time)}
                </span>
                <span className="text-[13px] text-[var(--color-primary)]">
                  {event.event_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Narrative — or calm empty state before the first cron run */}
      {!brief || paragraphs.length === 0 ? (
        <div className="mb-8 text-[13px] text-[var(--color-secondary)]/50">
          Brief not yet generated
        </div>
      ) : (
        <div className="mb-8 text-[15px] leading-[1.65] tracking-[0.001em] text-[var(--color-primary)] space-y-3.5">
          {paragraphs.map((paragraph, idx) => (
            <p
              key={idx}
              className={idx === 0 ? 'first-letter:text-[var(--color-accent)]' : ''}
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {/* Movers */}
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-[var(--color-border)]">
          <div className="font-mono text-[11px] font-semibold tracking-[0.1em] uppercase text-[var(--color-secondary)]">
            Movers
          </div>
          <div className="font-mono text-[11px] text-[var(--color-secondary)]/60">
            24H · WATCHLIST
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <MoverColumn label="Gainers" tone="up" movers={gainers} />
          <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)]">
            <MoverColumn label="Losers" tone="down" movers={losers} />
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="mt-6 font-mono text-[11px] text-[var(--color-secondary)]/60 flex items-center gap-2">
        <span>Cached daily</span>
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-secondary)]" />
        <span>Next refresh {CUTOFF_TIME} UTC tomorrow</span>
      </div>
    </div>
  );
}