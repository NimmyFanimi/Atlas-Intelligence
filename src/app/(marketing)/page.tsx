import Link from 'next/link';

export default function LandingPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
      <div className="max-w-md flex flex-col items-center gap-4">
        <div className="w-10 h-10 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--color-accent)]">
            <path d="M12 2L2 22H7L12 12L17 22H22L12 2Z" fill="currentColor" />
          </svg>
        </div>
        <div className="font-mono text-xs tracking-widest text-[var(--color-accent)] uppercase">
          Atlas Intelligence
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-primary)]">
          Landing Page Coming Soon
        </h1>
        <p className="text-sm text-[var(--color-secondary)]">
          The public landing page is currently under development. Access the platform via the Markets Dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex items-center px-4 py-2 text-xs font-mono tracking-wider uppercase bg-[var(--color-surface)] hover:bg-[var(--color-surface)]/80 text-[var(--color-primary)] border border-[var(--color-border)] rounded-[var(--radius-sm)] transition-colors duration-150"
        >
          Go to Markets Dashboard →
        </Link>
      </div>
    </div>
  );
}

