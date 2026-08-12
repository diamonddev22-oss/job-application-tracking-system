import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApplicationTrendChart } from '../components/ApplicationTrendChart';
import { GoalProgressRing } from '../components/GoalProgressRing';
import { ManagerApplicationRow } from '../components/ManagerApplicationRow';
import { Spinner } from '../components/Spinner';
import { AccountStatusBadge } from '../components/StatusBadge';
import { useAllApplicationsQuery, useApplicationStatsQuery, useManagedUserQuery } from '../hooks/useManager';
import { APPLICATION_GOAL, APPLICATION_STATUSES, type ApplicationStatus } from '../types';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 10;

export function ManagerUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [status]);

  const userQuery = useManagedUserQuery(userId ?? '');
  const statsQuery = useApplicationStatsQuery(userId);
  const applicationsQuery = useAllApplicationsQuery({ userId, status, page, size: PAGE_SIZE });
  const applications = applicationsQuery.data;

  const totalApplied = userQuery.data?.applicationCount ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/manager" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to dashboard
        </Link>
      </div>

      {userQuery.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {userQuery.isError && <p className="text-sm text-red-600">Failed to load this applicant.</p>}

      {userQuery.data && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {userQuery.data.email.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{userQuery.data.email}</h1>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
                Joined {formatDate(userQuery.data.createdAt)}
                <AccountStatusBadge status={userQuery.data.status} />
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="card flex flex-wrap items-center gap-6 p-5">
        <GoalProgressRing current={totalApplied} goal={APPLICATION_GOAL} />
        <div>
          <p className="text-sm font-medium text-slate-500">Application goal</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {totalApplied}
            <span className="text-lg font-medium text-slate-400"> / {APPLICATION_GOAL}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {totalApplied < APPLICATION_GOAL
              ? `${APPLICATION_GOAL - totalApplied} more application${
                  APPLICATION_GOAL - totalApplied === 1 ? '' : 's'
                } to reach the goal of ${APPLICATION_GOAL}.`
              : `Goal reached — ${totalApplied} applications tracked.`}
          </p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Applications — last 14 days</h2>
        {statsQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {statsQuery.isError && <p className="text-sm text-red-600">Failed to load application stats.</p>}
        {statsQuery.data && <ApplicationTrendChart data={statsQuery.data.dailyTrend} />}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">All applications</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
              className="select"
            >
              <option value="">All</option>
              {APPLICATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="card overflow-hidden">
          {applicationsQuery.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {applicationsQuery.isError && (
            <p className="py-10 text-center text-sm text-red-600">Failed to load applications.</p>
          )}
          {applications && applications.items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              No applications {status ? `with status ${status}` : 'tracked'} for this applicant yet.
            </p>
          )}
          {applications && applications.items.length > 0 && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Screenshot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.items.map((application) => (
                  <ManagerApplicationRow key={application.id} application={application} showApplicant={false} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {applications && applications.totalElements > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {applications.page + 1} of {applications.totalPages} ({applications.totalElements} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={applications.page === 0}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={applications.last}
                onClick={() => setPage((current) => current + 1)}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
