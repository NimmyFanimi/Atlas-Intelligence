'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--color-background)]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className="flex-1 h-full overflow-y-auto min-w-0 flex flex-col scrollbar-none">
        {children}
      </main>
    </div>
  );
}
