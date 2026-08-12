import { useState } from 'react';
import type { DailyApplicationCount } from '../types';

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A lightweight CSS bar chart — deliberately not pulling in a charting library for one chart.
 * Purely a count-of-applications-per-day view (no per-status breakdown) so it stays meaningful
 * regardless of how many days are shown: bars fill the available width evenly (flex-1 per bar), so
 * this reads just as well with 7 days as with 90. Date labels thin themselves out automatically —
 * showing one for every bar would overlap once there are more than a handful — and an explicit
 * hover tooltip replaces the browser's native `title` tooltip (which is inconsistently styled and
 * often slow to appear) with something that always matches the rest of the UI. */
export function ApplicationTrendChart({ data }: { data: DailyApplicationCount[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((point) => point.count));
  const total = data.reduce((sum, point) => sum + point.count, 0);

  // Show at most ~8 date labels no matter how many bars there are, always including the last one
  // (today/most recent) so the axis stays readable instead of a wall of overlapping text.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
        No applications tracked in this period yet.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{total}</span> application{total === 1 ? '' : 's'} tracked
      </p>
      <div className="flex h-48 items-end gap-1 sm:gap-1.5">
        {data.map((point, index) => (
          <div
            key={point.date}
            className="group relative flex h-full flex-1 flex-col items-center justify-end"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {hoverIndex === index && (
              <div className="absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg">
                {point.count} on {shortDate(point.date)}
              </div>
            )}
            <div
              className={`w-full rounded-t-md transition-all ${
                point.count > 0
                  ? 'bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-700 group-hover:to-brand-500'
                  : 'bg-slate-100'
              }`}
              style={{ height: `${Math.max((point.count / max) * 100, point.count > 0 ? 4 : 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 sm:gap-1.5">
        {data.map((point, index) => (
          <div key={point.date} className="flex-1 text-center text-[10px] text-slate-400">
            {index % labelStep === 0 || index === data.length - 1 ? shortDate(point.date) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
