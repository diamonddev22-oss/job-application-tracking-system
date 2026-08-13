import { useEffect, useState } from 'react';
import { ApplicationTrendChart } from '../components/ApplicationTrendChart';
import { ManagerUserRow } from '../components/ManagerUserRow';
import { Spinner } from '../components/Spinner';
import { StatCard } from '../components/StatCard';
import { useApplicationStatsQuery, useManagedUsersQuery, useOverviewStatsQuery } from '../hooks/useManager';
import { ACCOUNT_STATUSES, type AccountStatus } from '../types';

const PAGE_SIZE = 10;

export function ManagerDashboardPage() {
  const overviewQuery = useOverviewStatsQuery();
  const applicationStatsQuery = useApplicationStatsQuery();

  const [statusFilter, setStatusFilter] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  const usersQuery = useManagedUsersQuery({ status: statusFilter, page, size: PAGE_SIZE });
  const users = usersQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manager dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Monitor applicant activity and approve or reject pending accounts.
        </p>
      </div>

      <section>
        {overviewQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {overviewQuery.isError && <p className="text-sm text-red-600">Failed to load overview stats.</p>}
        {overviewQuery.data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total users" value={overviewQuery.data.totalUsers} />
            <StatCard label="Active" value={overviewQuery.data.activeUsers} accent="green" />
            <StatCard label="Pending approval" value={overviewQuery.data.pendingUsers} accent="amber" />
            <StatCard label="Rejected" value={overviewQuery.data.rejectedUsers} accent="red" />
            <StatCard label="Total applications" value={overviewQuery.data.totalApplications} />
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Applications — last 14 days</h2>
        {applicationStatsQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {applicationStatsQuery.isError && (
          <p className="text-sm text-red-600">Failed to load application stats.</p>
        )}
        {applicationStatsQuery.data && <ApplicationTrendChart data={applicationStatsQuery.data.dailyTrend} />}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Registered users</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Click an applicant's email to review and track their individual applications.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AccountStatus | '')}
              className="select"
            >
              <option value="">All</option>
              {ACCOUNT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="card overflow-hidden">
          {usersQuery.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {usersQuery.isError && <p className="py-10 text-center text-sm text-red-600">Failed to load applicants.</p>}
          {users && users.items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No applicants found.</p>
          )}
          {users && users.items.length > 0 && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applications</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.items.map((user) => (
                  <ManagerUserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {users && users.totalElements > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {users.page + 1} of {users.totalPages} ({users.totalElements} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={users.page === 0}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={users.last}
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
