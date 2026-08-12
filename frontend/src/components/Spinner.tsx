interface SpinnerProps {
  size?: 'sm' | 'md';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  const dimension = size === 'sm' ? 'h-4 w-4 border-2' : 'h-8 w-8 border-[3px]';
  return (
    <div
      className={`${dimension} animate-spin rounded-full border-slate-200 border-t-brand-600`}
      role="status"
      aria-label="Loading"
    />
  );
}
