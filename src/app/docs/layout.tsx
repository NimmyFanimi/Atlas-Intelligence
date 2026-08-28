'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import DocsSidebar from '@/components/docs/DocsSidebar';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Landing /docs has its own centered shell — don't wrap it with sidebar chrome
  if (pathname === '/docs') {
    return <>{children}</>;
  }

  return (
    <div className="docs-root h-screen overflow-hidden bg-[var(--bg)] text-[var(--text-primary)] flex relative">
      {/* Desktop sidebar — in-flow, hidden on mobile */}
      <div className="hidden md:flex">
        <DocsSidebar onNavigate={() => setTimeout(() => setIsMobileDrawerOpen(false), 0)} />
      </div>

      {/* Main column: mobile header + content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile-only top bar with hamburger */}
        <header className="flex md:hidden items-center h-14 px-4 border-b border-[var(--border)] shrink-0 bg-[var(--bg)]">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open docs navigation"
            className="inline-flex items-center justify-center w-9 h-9 text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-[8px] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Docs</span>
        </header>

        {/* Content area — layout provides the two-column flex shell; pages provide scrollable inner + optional TOC */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {children}
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(6,7,8,0.72)' }}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer — fixed overlay, slides from left */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-[var(--surface-1)] border-r border-[var(--border)] transform transition-transform duration-200 ease-in-out md:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <DocsSidebar onNavigate={() => setTimeout(() => setIsMobileDrawerOpen(false), 0)} />
      </div>
    </div>
  );
}
