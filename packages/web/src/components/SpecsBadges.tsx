function formatSpecEntry(key: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (key === 'capacity_gb') return `${String(value)} GB`;
  if (key === 'speed_mhz') return `${String(value)} MHz`;
  if (key === 'ram_type') return String(value);
  if (key === 'is_kit') return value === true ? 'Kit' : null;
  return `${key}: ${String(value)}`;
}

export function SpecsBadges({ specs }: { specs: Record<string, unknown> }) {
  const items = Object.entries(specs)
    .map(([key, value]) => ({ key, label: formatSpecEntry(key, value) }))
    .filter((item): item is { key: string; label: string } => Boolean(item.label));

  if (items.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map(({ key, label }) => (
        <li
          key={`${key}-${label}`}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}
