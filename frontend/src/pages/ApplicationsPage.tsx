import { useEffect, useState } from 'react';
import { ApplicationRow } from '../components/ApplicationRow';
import { Spinner } from '../components/Spinner';
import { useApplicationsQuery } from '../hooks/useApplications';
import { APPLICATION_STATUSES, type ApplicationStatus } from '../types';

const PAGE_SIZE = 10;

export function ApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [status]);

  const query = useApplicationsQuery({ status, page, size: PAGE_SIZE });
  const data = query.data;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Application History</h1>
          <p className="text-sm text-slate-500">
            Applications tracked automatically from the Chrome extension appear here.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ApplicationStatus | '')}
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

      <div className="rounded-lg border border-slate-200 bg-white px-4 shadow-sm">
        {query.isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {query.isError && (
          <p className="py-10 text-center text-sm text-red-600">Failed to load applications.</p>
        )}

        {data && data.items.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            No applications {status ? `with status ${status}` : 'yet'}. Install the Chrome extension
            and apply to a job to see it show up here.
          </p>
        )}

        {data && data.items.length > 0 && (
          <div>
            {data.items.map((application) => (
              <ApplicationRow key={application.id} application={application} />
            ))}
          </div>
        )}
      </div>

      {data && data.totalElements > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {data.page + 1} of {data.totalPages} ({data.totalElements} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page === 0}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.last}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
