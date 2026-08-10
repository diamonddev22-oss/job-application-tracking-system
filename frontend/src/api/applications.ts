import { apiClient } from './client';
import type { ApiEnvelope, ApplicationHistoryEntry, ApplicationStatus, JobApplication, PageResponse } from '../types';

export interface ListApplicationsParams {
  status?: ApplicationStatus | '';
  page: number;
  size: number;
}

export async function listApplications(params: ListApplicationsParams): Promise<PageResponse<JobApplication>> {
  const { data } = await apiClient.get<ApiEnvelope<PageResponse<JobApplication>>>('/applications', {
    params: {
      page: params.page,
      size: params.size,
      status: params.status || undefined,
    },
  });
  return data.data;
}

export async function getApplicationHistory(id: string): Promise<ApplicationHistoryEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<ApplicationHistoryEntry[]>>(`/applications/${id}/history`);
  return data.data;
}
