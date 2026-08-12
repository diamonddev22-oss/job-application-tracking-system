import { apiClient } from './client';
import type {
  AccountStatus,
  ApiEnvelope,
  ApplicationStats,
  ApplicationStatus,
  ManagerApplication,
  ManagerUser,
  OverviewStats,
  PageResponse,
} from '../types';

export async function getOverviewStats(): Promise<OverviewStats> {
  const { data } = await apiClient.get<ApiEnvelope<OverviewStats>>('/manager/stats/overview');
  return data.data;
}

export async function getApplicationStats(userId?: string): Promise<ApplicationStats> {
  const { data } = await apiClient.get<ApiEnvelope<ApplicationStats>>('/manager/stats/applications', {
    params: { userId: userId || undefined },
  });
  return data.data;
}

export interface ListManagedUsersParams {
  status?: AccountStatus | '';
  page: number;
  size: number;
}

export async function listManagedUsers(params: ListManagedUsersParams): Promise<PageResponse<ManagerUser>> {
  const { data } = await apiClient.get<ApiEnvelope<PageResponse<ManagerUser>>>('/manager/users', {
    params: {
      page: params.page,
      size: params.size,
      status: params.status || undefined,
    },
  });
  return data.data;
}

export async function getManagedUser(id: string): Promise<ManagerUser> {
  const { data } = await apiClient.get<ApiEnvelope<ManagerUser>>(`/manager/users/${id}`);
  return data.data;
}

export async function approveUser(id: string): Promise<ManagerUser> {
  const { data } = await apiClient.patch<ApiEnvelope<ManagerUser>>(`/manager/users/${id}/approve`);
  return data.data;
}

export async function rejectUser(id: string): Promise<ManagerUser> {
  const { data } = await apiClient.patch<ApiEnvelope<ManagerUser>>(`/manager/users/${id}/reject`);
  return data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/manager/users/${id}`);
}

export interface ListAllApplicationsParams {
  userId?: string;
  status?: ApplicationStatus | '';
  page: number;
  size: number;
}

export async function listAllApplications(
  params: ListAllApplicationsParams,
): Promise<PageResponse<ManagerApplication>> {
  const { data } = await apiClient.get<ApiEnvelope<PageResponse<ManagerApplication>>>('/manager/applications', {
    params: {
      userId: params.userId || undefined,
      status: params.status || undefined,
      page: params.page,
      size: params.size,
    },
  });
  return data.data;
}

export async function deleteApplication(id: string): Promise<void> {
  await apiClient.delete(`/manager/applications/${id}`);
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<ManagerApplication> {
  const { data } = await apiClient.patch<ApiEnvelope<ManagerApplication>>(`/manager/applications/${id}/status`, {
    status,
  });
  return data.data;
}
