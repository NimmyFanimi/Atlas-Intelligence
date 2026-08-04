export default function NewsEnginePage() {
  return (
    <div className="p-6 flex-1 bg-[var(--color-background)]">
      <div className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
        <h1 className="text-lg font-semibold text-[var(--color-primary)] mb-2">
          News Engine
        </h1>
        <p className="text-sm text-[var(--color-secondary)]">
          Real-time institutional news feed, sentiment analysis, and alert routing. Under development.
        </p>
      </div>
    </div>
  );
}
