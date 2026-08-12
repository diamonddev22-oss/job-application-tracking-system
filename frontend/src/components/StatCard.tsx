interface StatCardProps {
  label: string;
  value: number | string;
  accent?: 'default' | 'green' | 'amber' | 'red';
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, { text: string; dot: string }> = {
  default: { text: 'text-slate-900', dot: 'bg-brand-500' },
  green: { text: 'text-green-600', dot: 'bg-green-500' },
  amber: { text: 'text-amber-600', dot: 'bg-amber-500' },
  red: { text: 'text-red-600', dot: 'bg-red-500' },
};

export function StatCard({ label, value, accent = 'default' }: StatCardProps) {
  const { text, dot } = ACCENTS[accent];
  return (
    <div className="card p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${text}`}>{value}</p>
    </div>
  );
}
