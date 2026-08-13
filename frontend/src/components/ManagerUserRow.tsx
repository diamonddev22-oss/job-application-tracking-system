import { Link } from 'react-router-dom';
import { getErrorMessage } from '../api/errors';
import { useApproveUserMutation, useDeleteUserMutation, useRejectUserMutation } from '../hooks/useManager';
import { APPLICATION_GOAL, type ManagerUser } from '../types';
import { formatDate } from '../utils/format';
import { GoalProgressBar } from './GoalProgressRing';
import { ResumeUploadControl } from './ResumeUploadControl';
import { AccountStatusBadge } from './StatusBadge';

export function ManagerUserRow({ user }: { user: ManagerUser }) {
  const approveMutation = useApproveUserMutation();
  const rejectMutation = useRejectUserMutation();
  const deleteMutation = useDeleteUserMutation();
  const isPending = approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;
  const error = approveMutation.error ?? rejectMutation.error ?? deleteMutation.error;

  const handleDelete = () => {
    if (
      window.confirm(
        `Permanently delete ${user.email}? This removes their account, profile, resumes, and all tracked applications. This cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(user.id);
    }
  };

  return (
    <tr className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {user.email.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <Link
              to={`/manager/users/${user.id}`}
              className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
            >
              {user.email}
            </Link>
            <p className="text-xs text-slate-400">Joined {formatDate(user.createdAt)}</p>
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{getErrorMessage(error)}</p>}
      </td>
      <td className="px-4 py-3">
        <AccountStatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3">
        <ResumeUploadControl userId={user.id} resume={user.latestResume} />
      </td>
      <td className="px-4 py-3">
        <GoalProgressBar current={user.applicationCount} goal={APPLICATION_GOAL} />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {user.status !== 'ACTIVE' && (
            <button
              type="button"
              disabled={isPending || !user.latestResume}
              onClick={() => approveMutation.mutate(user.id)}
              title={user.latestResume ? undefined : 'Upload a resume for this applicant before approving'}
              className="btn-outline-success btn-sm"
            >
              Approve
            </button>
          )}
          {user.status !== 'REJECTED' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => rejectMutation.mutate(user.id)}
              className="btn-danger btn-sm"
            >
              Reject
            </button>
          )}
          <button type="button" disabled={isPending} onClick={handleDelete} className="btn-outline-danger btn-sm">
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
