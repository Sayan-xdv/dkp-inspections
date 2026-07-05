export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-4 w-96 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border border-gray-200/80 bg-white animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-gray-200/80 bg-white animate-pulse" />
    </div>
  );
}
