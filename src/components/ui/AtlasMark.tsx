import React from 'react';

/**
 * Atlas logo mark — single source of truth for the triangle icon.
 * Reused by: src/components/ui/Sidebar.tsx (app sidebar),
 * src/app/(marketing)/page.tsx (landing top bar),
 * src/components/docs/DocsTopBar.tsx (docs top bar).
 *
 * The SVG path is the canonical Atlas triangle: d="M12 2L2 22H7L12 12L17 22H22L12 2Z"
 */
export default function AtlasMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        `w-8 h-8 rounded-[7px] bg-[rgba(13,148,136,0.12)] flex items-center justify-center text-[var(--color-accent)] flex-shrink-0`
      }
      style={className ? undefined : { width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" />
      </svg>
    </div>
  );
}

// Named export for the bare SVG (no container) — useful when caller wants its own wrapper
export function AtlasTriangle({ className = 'w-[18px] h-[18px] text-[var(--color-accent)]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" />
    </svg>
  );
}
