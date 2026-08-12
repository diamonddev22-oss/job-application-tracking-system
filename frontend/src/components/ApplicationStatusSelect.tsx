import { getErrorMessage } from '../api/errors';
import { useUpdateApplicationStatusMutation } from '../hooks/useManager';
import { APPLICATION_STATUSES, type ApplicationStatus } from '../types';
import { APPLICATION_STATUS_STYLES } from './StatusBadge';

/** Manager-only control for advancing/correcting an applicant's pipeline stage — a `<select>`
 * dyed to match the same colors as the read-only `ApplicationStatusBadge` so it still reads as a
 * status pill at a glance, just editable. Users never see this; their view of status stays the
 * plain badge (see `ApplicationRow`). */
export function ApplicationStatusSelect({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) {
  const mutation = useUpdateApplicationStatusMutation();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value as ApplicationStatus;
    if (nextStatus !== status) {
      mutation.mutate({ id: applicationId, status: nextStatus });
    }
  };

  return (
    <div>
      <select
        value={status}
        onChange={handleChange}
        disabled={mutation.isPending}
        className={`badge cursor-pointer border-0 pr-6 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-wait disabled:opacity-60 ${APPLICATION_STATUS_STYLES[status]}`}
      >
        {APPLICATION_STATUSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {mutation.isError && <p className="mt-1 text-xs text-red-600">{getErrorMessage(mutation.error)}</p>}
    </div>
  );
}
