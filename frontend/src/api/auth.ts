import { apiClient } from './client';
import type { ApiEnvelope, AuthResponse } from '../types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/login', { email, password });
  return data.data;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/register', { email, password });
  return data.data;
}
