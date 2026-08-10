import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveUser,
  deleteApplication,
  deleteUser,
  getApplicationStats,
  getOverviewStats,
  listAllApplications,
  listManagedUsers,
  rejectUser,
  type ListAllApplicationsParams,
  type ListManagedUsersParams,
} from '../api/manager';

export function useOverviewStatsQuery() {
  return useQuery({
    queryKey: ['manager', 'overview'],
    queryFn: getOverviewStats,
  });
}

export function useApplicationStatsQuery() {
  return useQuery({
    queryKey: ['manager', 'application-stats'],
    queryFn: getApplicationStats,
  });
}

export function useManagedUsersQuery(params: ListManagedUsersParams) {
  return useQuery({
    queryKey: ['manager', 'users', params],
    queryFn: () => listManagedUsers(params),
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
