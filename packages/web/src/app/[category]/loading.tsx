export default function CategoryLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
