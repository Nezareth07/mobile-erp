import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignUserRoles,
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
} from '../api'
import type {
  UserCreatePayload,
  UserRoleAssignmentPayload,
  UserUpdatePayload,
} from '../types/user'

const USERS_KEY = ['administration', 'users']

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: listUsers,
  })
}

// Fetches a single user fresh -- used by AssignRolesDialog to know the
// user's *current* role assignment before the checklist can be shown or
// submitted (PUT /users/{id}/roles replaces the full set, so hydrating
// from a possibly-stale list-cache row would risk wiping roles).
export function useUserQuery(userId: string | null) {
  return useQuery({
    queryKey: [...USERS_KEY, userId],
    queryFn: () => getUser(userId as string),
    enabled: userId !== null,
    retry: false,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createUser(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UserUpdatePayload
    }) => updateUser(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useAssignUserRoles() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: UserRoleAssignmentPayload
    }) => assignUserRoles(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}
