interface SpinnerProps {
  size?: 'sm' | 'md';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  const dimension = size === 'sm' ? 'h-4 w-4' : 'h-8 w-8';
  return (
    <div
      className={`${dimension} animate-spin rounded-full border-2 border-slate-200 border-t-brand-600`}
      role="status"
      aria-label="Loading"
    />
  );
}
