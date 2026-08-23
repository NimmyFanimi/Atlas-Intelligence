import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="p-9">
      <div className="font-mono text-[11px] tracking-[0.05em] uppercase text-[var(--color-secondary)]/60 mb-4">
        <Link href="/commodities" className="hover:text-[var(--color-accent)] transition-colors">
          Commodities
        </Link>
        <span className="mx-1">/</span>
        <span className="text-[var(--color-accent)]">Not Found</span>
      </div>
      <div className="text-[16px] font-semibold text-[var(--color-primary)] mb-2">Commodity not found</div>
      <p className="text-[13px] text-[var(--color-secondary)]/60 mb-4">
        The requested commodity does not exist.
      </p>
      <Link
        href="/commodities"
        className="font-mono text-[11px] tracking-[0.08em] uppercase text-[var(--color-accent)] hover:underline"
      >
        Back to Commodities
      </Link>
    </div>
  );
}
