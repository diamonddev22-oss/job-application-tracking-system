import { useState } from 'react';
import { useApplicationHistoryQuery } from '../hooks/useApplications';
import type { JobApplication } from '../types';
import { formatDate, formatDateTime } from '../utils/format';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';
import { ApplicationStatusBadge } from './StatusBadge';
import { Spinner } from './Spinner';

export function ApplicationRow({ application }: { application: JobApplication }) {
  const [expanded, setExpanded] = useState(false);
  const historyQuery = useApplicationHistoryQuery(application.id, expanded);

  return (
    <div className="border-b border-slate-200 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {application.screenshotUrl && (
            <ScreenshotThumbnail
              url={application.screenshotUrl}
              label={`${application.jobTitle} at ${application.company}`}
            />
          )}
          <div className="min-w-0">
            <a
              href={application.jobUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-900 hover:text-brand-600"
            >
              {application.jobTitle}
            </a>
            <p className="text-sm text-slate-500">{application.company}</p>
            <p className="mt-1 text-xs text-slate-400">Applied {formatDate(application.appliedDate)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={application.status} />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            {expanded ? 'Hide history' : 'View history'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 rounded-md bg-slate-50 p-3">
          {historyQuery.isLoading && (
            <div className="flex justify-center py-2">
              <Spinner size="sm" />
            </div>
          )}
          {historyQuery.isError && <p className="text-xs text-red-600">Failed to load history.</p>}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <ul className="space-y-1.5 text-xs text-slate-600">
              {historyQuery.data.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span>
                    {entry.oldStatus ? (
                      <>
                        {entry.oldStatus} <span aria-hidden="true">→</span> {entry.newStatus}
                      </>
                    ) : (
                      <>Tracked as {entry.newStatus}</>
                    )}
                  </span>
                  <span className="shrink-0 text-slate-400">{formatDateTime(entry.changedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
