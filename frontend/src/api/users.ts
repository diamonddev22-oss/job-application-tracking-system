import { apiClient } from './client';
import type { ApiEnvelope, UserSummary } from '../types';

export async function getCurrentUser(): Promise<UserSummary> {
  const { data } = await apiClient.get<ApiEnvelope<UserSummary>>('/users/me');
  return data.data;
}
