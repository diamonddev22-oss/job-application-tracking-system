import type { AccountStatus, ApplicationStatus } from '../types';

const APPLICATION_STYLES: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-blue-100 text-blue-700',
  SCREENING: 'bg-indigo-100 text-indigo-700',
  INTERVIEW: 'bg-purple-100 text-purple-700',
  OFFER: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-slate-200 text-slate-600',
};

const ACCOUNT_STYLES: Record<AccountStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const DOT_STYLES: Record<string, string> = {
  'bg-blue-100 text-blue-700': 'bg-blue-500',
  'bg-indigo-100 text-indigo-700': 'bg-indigo-500',
  'bg-purple-100 text-purple-700': 'bg-purple-500',
  'bg-amber-100 text-amber-800': 'bg-amber-500',
  'bg-green-100 text-green-700': 'bg-green-500',
  'bg-red-100 text-red-700': 'bg-red-500',
  'bg-slate-200 text-slate-600': 'bg-slate-500',
};

function badgeClasses(style: string) {
  return `badge ${style}`;
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const style = APPLICATION_STYLES[status];
  return (
    <span className={badgeClasses(style)}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[style]}`} />
      {status}
    </span>
  );
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const style = ACCOUNT_STYLES[status];
  return (
    <span className={badgeClasses(style)}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[style]}`} />
      {status.replace('_', ' ')}
    </span>
  );
}
