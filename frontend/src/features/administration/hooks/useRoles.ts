import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignRolePermissions,
  createRole,
  deactivateRole,
  getRole,
  listRoles,
  updateRole,
} from '../api'
import type {
  RoleCreatePayload,
  RolePermissionAssignmentPayload,
  RoleUpdatePayload,
} from '../types/role'

const ROLES_KEY = ['administration', 'roles']

export function useRolesQuery() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: listRoles,
  })
}

// Fetches a single role fresh -- used by AssignPermissionsDialog to know
// the role's *current* permission assignment before the checklist can be
// shown or submitted (PUT /roles/{id}/permissions replaces the full set,
// so hydrating from a possibly-stale list-cache row would risk wiping
// permissions).
export function useRoleQuery(roleId: string | null) {
  return useQuery({
    queryKey: [...ROLES_KEY, roleId],
    queryFn: () => getRole(roleId as string),
    enabled: roleId !== null,
    retry: false,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRole(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: RoleUpdatePayload
    }) => updateRole(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useDeactivateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deactivateRole(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}

export function useAssignRolePermissions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: RolePermissionAssignmentPayload
    }) => assignRolePermissions(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  })
}
