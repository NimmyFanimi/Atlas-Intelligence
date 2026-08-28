'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--color-background)]">
      {/* Desktop sidebar — in-flow, hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </div>

      <main className="flex-1 h-full overflow-y-auto min-w-0 flex flex-col scrollbar-none">
        {/* Mobile-only top bar with hamburger */}
        <header className="flex md:hidden items-center h-14 px-4 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-background)]">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Open navigation"
            className="inline-flex items-center justify-center w-9 h-9 text-[var(--color-primary)] hover:bg-[var(--color-surface)] rounded-[var(--radius-sm)] transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>
        {children}
      </main>

      {/* Mobile backdrop — same rgba as NewsFeed modal */}
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-background)] border-r border-[var(--color-border)] transform transition-transform duration-200 ease-in-out md:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          isCollapsed={false}
          setIsCollapsed={setIsCollapsed}
          onNavigate={() => setIsMobileDrawerOpen(false)}
        />
      </div>
    </div>
  );
}
