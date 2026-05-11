'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-[24px] p-8 text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
          出了点问题
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {error.message || '加载页面时发生错误'}
        </p>
        <button
          onClick={reset}
          className="rounded-full px-6 py-2.5 text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-dark)] transition-colors"
        >
          重试
        </button>
      </div>
    </main>
  );
}
