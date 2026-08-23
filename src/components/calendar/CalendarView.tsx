'use client';

import React from 'react';
import { TrackedRelease, TRACKED_RELEASES } from '@/lib/data-sources/tracked-releases';

export interface CalendarEvent {
  id: string;
  fred_release_id: string;
  event_name: string;
  country: string;
  category: string;
  importance: string;
  release_date: string;
  status: string;
  data_source: string | null;
}

export interface GroupedDay {
  date: string;
  events: CalendarEvent[];
}

interface CalendarViewProps {
  groupedDays: GroupedDay[];
  tbdReleases: TrackedRelease[];
  nextEvent: CalendarEvent | null;
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
  return `${day} ${month}`;
}

function formatDayLabel(dateStr: string) {
  const date = new Date(dateStr);
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(date);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
  return { weekday, monthDay: `${day} ${month}` };
}

function EventCard({ event }: { event: CalendarEvent }) {
  const tracked = TRACKED_RELEASES.find(r => r.releaseId === event.fred_release_id);
  const secondaryName = tracked?.secondaryName || '';
  const isNonFred = event.data_source && event.data_source !== 'fred';
  
  const importanceOpacity = 
    event.importance === 'high' ? 'opacity-100' : 
    event.importance === 'medium' ? 'opacity-[0.45]' : 
    'opacity-[0.15]';
  
  return (
    <div className="grid grid-cols-[3px_1fr_auto] items-center gap-4 py-4 pr-1 pl-4 border-t border-[var(--color-border)] transition-colors duration-150 hover:bg-white/[0.015]">
      <div className={`w-[3px] rounded-[2px] self-stretch bg-[var(--color-accent)] ${importanceOpacity}`}></div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[var(--color-primary)] leading-tight">{event.event_name}</div>
        {secondaryName && <div className="text-xs text-[var(--color-secondary)]/70 mb-1.5">{secondaryName}</div>}
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.03em] text-[var(--color-secondary)]/70">{event.category}</span>
          <span className="text-[11px] text-[var(--color-secondary)]">{event.country}</span>
          <span className="text-[10px] font-mono tracking-[0.03em] uppercase text-[var(--color-accent)]">{event.importance}</span>
        </div>
        {isNonFred && (
          <div className="text-[10px] text-[var(--color-secondary)]/50 mt-1">
            Unofficial source
          </div>
        )}
      </div>
      <div className="justify-self-end text-right">
        <div className="inline-flex items-center text-[10px] font-mono px-[7px] py-[2px] rounded text-[var(--color-accent)] bg-[var(--color-accent)]/10 relative group">
          Confirmed
        </div>
      </div>
    </div>
  );
}

function TbdEventCard({ release }: { release: TrackedRelease }) {
  const importanceOpacity = 
    release.importance === 'high' ? 'opacity-100' : 
    release.importance === 'medium' ? 'opacity-[0.45]' : 
    'opacity-[0.15]';

  return (
    <div className="grid grid-cols-[3px_1fr_auto] items-center gap-4 py-4 pr-1 pl-4 border-t border-[var(--color-border)] transition-colors duration-150 hover:bg-white/[0.015]">
      <div className={`w-[3px] rounded-[2px] self-stretch bg-[var(--color-accent)] ${importanceOpacity}`}></div>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-[var(--color-primary)] leading-tight">{release.primaryName}</div>
        <div className="text-xs text-[var(--color-secondary)]/70 mb-1.5">{release.secondaryName}</div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono uppercase tracking-[0.03em] text-[var(--color-secondary)]/70">{release.category}</span>
          <span className="text-[11px] text-[var(--color-secondary)]">{release.country}</span>
          <span className="text-[10px] font-mono tracking-[0.03em] uppercase text-[var(--color-accent)]">{release.importance}</span>
        </div>
      </div>
      <div className="justify-self-end text-right">
        <div className="inline-flex items-center text-[10px] font-mono px-[7px] py-[2px] rounded text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 cursor-default relative group">
          Date TBD
          <div className="absolute bottom-[calc(100%+8px)] right-0 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-secondary)] font-sans text-[11px] leading-snug px-[11px] py-[9px] rounded-md w-[200px] whitespace-normal opacity-0 translate-y-1 transition-all duration-150 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto z-10 text-left shadow-none">
            FRED hasn't published the next release date yet.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarView({
  groupedDays,
  tbdReleases,
  nextEvent,
}: CalendarViewProps) {
  return (
    <div className="p-9 max-w-[660px]">
      <div className="mb-7">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[13px] font-semibold tracking-[0.06em] uppercase text-[var(--color-secondary)]">
            Economic calendar
          </span>
        </div>
        {nextEvent && (
          <div className="text-[11px] font-mono text-[var(--color-secondary)]/70">
            <span>NEXT - </span>
            <span className="text-[var(--color-secondary)]">{nextEvent.event_name} · {formatShortDate(nextEvent.release_date)}</span>
          </div>
        )}
      </div>

      {groupedDays.length === 0 ? (
        <div className="text-[13px] text-[var(--color-secondary)]/50 px-[2px] py-2">
          No confirmed releases this week
        </div>
      ) : (
        groupedDays.map((group) => {
          const { weekday, monthDay } = formatDayLabel(group.date);
          return (
            <div key={group.date} className="mb-2">
              <div className="flex items-baseline gap-2.5 pb-3 pt-4 px-[2px]">
                <span className="text-xs font-medium text-[var(--color-secondary)]">{weekday}</span>
                <span className="text-[11px] font-mono text-[var(--color-secondary)]/70">{monthDay}</span>
              </div>

              {group.events.length > 0 ? (
                group.events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="text-[13px] text-[var(--color-secondary)]/50 px-4 py-2">
                  No releases
                </div>
              )}
            </div>
          );
        })
      )}

      {tbdReleases.length > 0 && (
        <div className="mt-8">
          <div className="flex items-baseline gap-2.5 pb-3 px-[2px]">
            <span className="text-xs font-medium text-[var(--color-secondary)]">Date pending</span>
          </div>
          {tbdReleases.map((release) => (
            <TbdEventCard key={release.releaseId} release={release} />
          ))}
        </div>
      )}
    </div>
  );
}
