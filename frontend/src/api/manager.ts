import { apiClient } from './client';
import type {
  AccountStatus,
  ApiEnvelope,
  ApplicationStats,
  ApplicationStatus,
  ManagedResume,
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

interface ResumeUploadUrlResponse {
  uploadUrl: string;
  key: string;
  fileUrl: string;
  expiresAt: string;
}

// Not every browser/OS reliably sets `file.type` for older Office formats — fall back to the
// extension so the upload isn't rejected by the backend's content-type allowlist for no reason.
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? '';
}

/** Uploads a resume on an applicant's behalf: presigned PUT straight to S3/MinIO/R2 (never through
 * the backend), then registers the resulting object as a new resume version for that user. Mirrors
 * the applicant-facing flow in backend/app/resumes, just targeting `userId` from the manager side
 * instead of the caller's own account. */
export async function uploadManagerResume(userId: string, file: File): Promise<ManagedResume> {
  const contentType = resolveContentType(file);
  if (!contentType) {
    throw new Error('Only PDF and Word documents (.pdf, .doc, .docx) are supported.');
  }

  const { data: uploadUrlEnvelope } = await apiClient.post<ApiEnvelope<ResumeUploadUrlResponse>>(
    `/manager/users/${userId}/resumes/upload-url`,
    { fileName: file.name, contentType },
  );
  const { uploadUrl, key } = uploadUrlEnvelope.data;

  const putResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!putResponse.ok) {
    throw new Error(`Resume upload to storage failed (${putResponse.status})`);
  }

  const { data } = await apiClient.post<ApiEnvelope<ManagedResume>>(`/manager/users/${userId}/resumes`, { key });
  return data.data;
}
