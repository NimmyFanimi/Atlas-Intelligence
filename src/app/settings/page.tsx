export default function SettingsPage() {
  return (
    <div className="p-6 flex-1 bg-[var(--color-background)]">
      <div className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
        <h1 className="text-lg font-semibold text-[var(--color-primary)] mb-2">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-secondary)]">
          System settings, user preferences, API keys, and notification channels will be configurable here. Under development.
        </p>
      </div>
    </div>
  );
}
