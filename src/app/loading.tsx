export default function Loading() {
  return (
    <main className="min-h-screen">
      {/* Topbar skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="glass-strong h-16" />
      </div>

      {/* Hero skeleton */}
      <div className="pt-28 pb-12 px-4 sm:px-6 max-w-7xl mx-auto text-center">
        <div className="skeleton h-10 w-64 mx-auto mb-4 rounded-full" />
        <div className="skeleton h-5 w-96 mx-auto mb-8 rounded-full" />
        <div className="flex items-center justify-center gap-6">
          <div className="skeleton h-10 w-28 rounded-full" />
          <div className="skeleton h-10 w-24 rounded-full" />
        </div>
      </div>

      {/* Pills skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-9 rounded-full" style={{ width: 60 + Math.random() * 40 }} />
          ))}
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="mosaic-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mb-5 break-inside-avoid">
              <div className="glass rounded-[20px] overflow-hidden">
                <div className="skeleton w-full" style={{ aspectRatio: ['4/5', '3/4', '16/9', '1/1'][i % 4] }} />
                <div className="p-4 space-y-3">
                  <div className="skeleton h-4 w-3/4 rounded-full" />
                  <div className="skeleton h-3 w-full rounded-full" />
                  <div className="skeleton h-3 w-2/3 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
