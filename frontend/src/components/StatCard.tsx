interface StatCardProps {
  label: string;
  value: number | string;
  accent?: 'default' | 'green' | 'amber' | 'red';
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, string> = {
  default: 'text-slate-900',
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
};

export function StatCard({ label, value, accent = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${ACCENTS[accent]}`}>{value}</p>
    </div>
  );
}
