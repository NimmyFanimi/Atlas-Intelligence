import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-9 max-w-[660px]">
      {/* Header — matches CommoditiesOverview / MorningBriefView eyebrow + title */}
      <div className="mb-7">
        <div className="font-mono text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-accent)]">
          Settings
        </div>
        <div className="text-2xl font-semibold tracking-[-0.01em] mt-1.5 text-[var(--color-primary)]">
          Settings
        </div>
      </div>

      {/* Planned card — mirrors Sidebar PlannedItem: opacity-40, text-secondary, muted icon, no new tokens */}
      <div className="border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-[var(--color-border)]">
          <span className="flex items-center gap-2.5 opacity-40">
            <Settings className="w-4 h-4 text-[var(--color-secondary)] flex-shrink-0" />
            <span className="font-mono text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--color-secondary)]">
              Planned
            </span>
          </span>
          <span className="ml-auto inline-flex items-center text-[10px] font-mono px-[7px] py-[2px] rounded text-[var(--color-secondary)] bg-[var(--color-secondary)]/10">
            Coming in a future version
          </span>
        </div>
        <div className="px-[18px] py-5">
          <p className="text-[13px] leading-[1.65] text-[var(--color-secondary)]">
            System settings, user preferences, API keys, and notification channels will be configurable here.
          </p>
        </div>
      </div>
    </div>
  );
}
