import { getErrorMessage } from '../api/errors';
import { useApproveUserMutation, useDeleteUserMutation, useRejectUserMutation } from '../hooks/useManager';
import type { ManagerUser } from '../types';
import { formatDate } from '../utils/format';
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
    <tr className="border-b border-slate-200 last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{user.email}</p>
        <p className="text-xs text-slate-400">Joined {formatDate(user.createdAt)}</p>
        {error && <p className="mt-1 text-xs text-red-600">{getErrorMessage(error)}</p>}
      </td>
      <td className="px-4 py-3">
        <AccountStatusBadge status={user.status} />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{user.applicationCount}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {user.status !== 'ACTIVE' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => approveMutation.mutate(user.id)}
              className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              Approve
            </button>
          )}
          {user.status !== 'REJECTED' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => rejectMutation.mutate(user.id)}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Reject
            </button>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
