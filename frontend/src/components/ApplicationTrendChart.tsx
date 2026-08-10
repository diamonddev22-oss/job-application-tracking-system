import type { DailyApplicationCount } from '../types';

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A lightweight CSS bar chart — deliberately not pulling in a charting library for one chart. */
export function ApplicationTrendChart({ data }: { data: DailyApplicationCount[] }) {
  const max = Math.max(1, ...data.map((point) => point.count));

  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((point) => (
        <div
          key={point.date}
          className="group flex h-full flex-1 flex-col justify-end"
          title={`${shortDate(point.date)}: ${point.count}`}
        >
          <div
            className="w-full rounded-t bg-brand-500 transition-colors group-hover:bg-brand-600"
            style={{ height: `${Math.max((point.count / max) * 100, point.count > 0 ? 4 : 1)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
