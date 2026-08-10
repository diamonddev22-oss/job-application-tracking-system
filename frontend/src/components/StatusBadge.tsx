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

function badgeClasses(style: string) {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`;
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={badgeClasses(APPLICATION_STYLES[status])}>{status}</span>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <span className={badgeClasses(ACCOUNT_STYLES[status])}>{status.replace('_', ' ')}</span>;
}
