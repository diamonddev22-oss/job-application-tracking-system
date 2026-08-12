interface GoalProgressRingProps {
  current: number;
  goal: number;
  size?: number;
}

/** A circular "N of goal" progress indicator, hand-rolled with SVG (a `<circle>` whose visible arc
 * length is controlled via `stroke-dasharray`/`stroke-dashoffset` — the standard technique for an
 * SVG ring chart, no charting library needed). Deliberately capped visually at 100% even if the
 * goal's been exceeded — the ring itself is about "how close", the exact number is in the label
 * next to it, which keeps climbing past the goal instead of being clamped. */
export function GoalProgressRing({ current, goal, size = 128 }: GoalProgressRingProps) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  const strokeWidth = size * 0.09;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#goal-progress-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id="goal-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{Math.round(pct)}%</span>
        <span className="text-[11px] font-medium text-slate-400">of goal</span>
      </div>
    </div>
  );
}

/** Compact linear version for tight spaces like a table cell — same "current vs. goal" idea
 * without the room a ring needs. */
export function GoalProgressBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  return (
    <div className="w-28">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-700">{current}</span>
        <span className="text-slate-400">/ {goal}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
