import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveUser,
  deleteApplication,
  deleteUser,
  getApplicationStats,
  getManagedUser,
  getOverviewStats,
  listAllApplications,
  listManagedUsers,
  rejectUser,
  updateApplicationStatus,
  type ListAllApplicationsParams,
  type ListManagedUsersParams,
} from '../api/manager';
import type { ApplicationStatus } from '../types';

export function useOverviewStatsQuery() {
  return useQuery({
    queryKey: ['manager', 'overview'],
    queryFn: getOverviewStats,
  });
}

export function useApplicationStatsQuery(userId?: string) {
  return useQuery({
    queryKey: ['manager', 'application-stats', userId ?? null],
    queryFn: () => getApplicationStats(userId),
  });
}

export function useManagedUsersQuery(params: ListManagedUsersParams) {
  return useQuery({
    queryKey: ['manager', 'users', params],
    queryFn: () => listManagedUsers(params),
  });
}

export function useManagedUserQuery(userId: string) {
  return useQuery({
    queryKey: ['manager', 'users', userId],
    queryFn: () => getManagedUser(userId),
    enabled: Boolean(userId),
  });
}

export function useAllApplicationsQuery(params: ListAllApplicationsParams) {
  return useQuery({
    queryKey: ['manager', 'applications', params],
    queryFn: () => listAllApplications(params),
  });
}

export function useApproveUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
    },
  });
}

export function useRejectUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rejectUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
    },
  });
}

export function useDeleteApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
    },
  });
}

export function useUpdateApplicationStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) => updateApplicationStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager'] });
    },
  });
}
