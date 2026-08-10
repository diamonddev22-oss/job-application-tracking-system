import { getErrorMessage } from '../api/errors';
import { useDeleteApplicationMutation } from '../hooks/useManager';
import type { ManagerApplication } from '../types';
import { formatDate } from '../utils/format';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';
import { ApplicationStatusBadge } from './StatusBadge';

export function ManagerApplicationRow({ application }: { application: ManagerApplication }) {
  const deleteMutation = useDeleteApplicationMutation();

  const handleDelete = () => {
    if (
      window.confirm(
        `Delete the "${application.jobTitle}" application at ${application.company} for ${application.userEmail}? This cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(application.id);
    }
  };

  return (
    <tr className="border-b border-slate-200 last:border-b-0">
      <td className="px-4 py-3 text-sm text-slate-600">{application.userEmail}</td>
      <td className="px-4 py-3">
        <a
          href={application.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-slate-900 hover:text-brand-600"
        >
          {application.jobTitle}
        </a>
        <p className="text-xs text-slate-500">{application.company}</p>
        {deleteMutation.error && (
          <p className="mt-1 text-xs text-red-600">{getErrorMessage(deleteMutation.error)}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <ScreenshotThumbnail
          url={application.screenshotUrl}
          label={`${application.jobTitle} at ${application.company}`}
        />
      </td>
      <td className="px-4 py-3">
        <ApplicationStatusBadge status={application.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(application.appliedDate)}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
