import React from 'react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[var(--color-background)] text-[var(--color-primary)]">
      {children}
    </div>
  );
}
