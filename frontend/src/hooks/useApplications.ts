import { useQuery } from '@tanstack/react-query';
import { getApplicationHistory, listApplications, type ListApplicationsParams } from '../api/applications';

export function useApplicationsQuery(params: ListApplicationsParams) {
  return useQuery({
    queryKey: ['applications', params],
    queryFn: () => listApplications(params),
  });
}

export function useApplicationHistoryQuery(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['application-history', applicationId],
    queryFn: () => getApplicationHistory(applicationId),
    enabled,
  });
}
