import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import { useDeleteApplicationMutation } from '../hooks/useManager';
import type { ManagerApplication } from '../types';
import { formatDate } from '../utils/format';
import { ApplicationStatusSelect } from './ApplicationStatusSelect';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';

interface ManagerApplicationRowProps {
  application: ManagerApplication;
  showApplicant?: boolean;
}

export function ManagerApplicationRow({ application, showApplicant = true }: ManagerApplicationRowProps) {
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
    <tr className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60">
      {showApplicant && (
        <td className="px-4 py-3 text-sm text-slate-600">
          <Link to={`/manager/users/${application.userId}`} className="hover:text-brand-700 hover:underline">
            {application.userEmail}
          </Link>
        </td>
      )}
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
        <ApplicationStatusSelect applicationId={application.id} status={application.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(application.appliedDate)}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
          className="btn-outline-danger btn-sm"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
