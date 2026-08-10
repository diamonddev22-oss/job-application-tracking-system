import { useEffect, useState } from 'react';
import { ApplicationTrendChart } from '../components/ApplicationTrendChart';
import { ManagerApplicationRow } from '../components/ManagerApplicationRow';
import { ManagerUserRow } from '../components/ManagerUserRow';
import { Spinner } from '../components/Spinner';
import { StatCard } from '../components/StatCard';
import { ApplicationStatusBadge } from '../components/StatusBadge';
import {
  useAllApplicationsQuery,
  useApplicationStatsQuery,
  useManagedUsersQuery,
  useOverviewStatsQuery,
} from '../hooks/useManager';
import { ACCOUNT_STATUSES, APPLICATION_STATUSES, type AccountStatus, type ApplicationStatus } from '../types';

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

  const [appStatusFilter, setAppStatusFilter] = useState<ApplicationStatus | ''>('');
  const [appPage, setAppPage] = useState(0);

  useEffect(() => {
    setAppPage(0);
  }, [appStatusFilter]);

  const applicationsQuery = useAllApplicationsQuery({ status: appStatusFilter, page: appPage, size: PAGE_SIZE });
  const applications = applicationsQuery.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Manager Dashboard</h1>
        <p className="text-sm text-slate-500">
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Applications — last 14 days</h2>
        {applicationStatsQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {applicationStatsQuery.isError && (
          <p className="text-sm text-red-600">Failed to load application stats.</p>
        )}
        {applicationStatsQuery.data && (
          <div className="space-y-6">
            <ApplicationTrendChart data={applicationStatsQuery.data.dailyTrend} />
            <div className="flex flex-wrap gap-4">
              {APPLICATION_STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <ApplicationStatusBadge status={status} />
                  <span className="text-slate-500">
                    {applicationStatsQuery.data.statusBreakdown[status] ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Applicants</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AccountStatus | '')}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {usersQuery.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {usersQuery.isError && (
            <p className="py-10 text-center text-sm text-red-600">Failed to load applicants.</p>
          )}
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
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={users.last}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">All Applications</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filter by status</span>
            <select
              value={appStatusFilter}
              onChange={(event) => setAppStatusFilter(event.target.value as ApplicationStatus | '')}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {applicationsQuery.isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {applicationsQuery.isError && (
            <p className="py-10 text-center text-sm text-red-600">Failed to load applications.</p>
          )}
          {applications && applications.items.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No applications found.</p>
          )}
          {applications && applications.items.length > 0 && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Screenshot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.items.map((application) => (
                  <ManagerApplicationRow key={application.id} application={application} />
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
                onClick={() => setAppPage((current) => Math.max(current - 1, 0))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={applications.last}
                onClick={() => setAppPage((current) => current + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
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
