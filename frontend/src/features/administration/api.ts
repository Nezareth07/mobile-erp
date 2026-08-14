import { api } from '../../lib/api'
import type {
  User,
  UserCreatePayload,
  UserUpdatePayload,
  UserRoleAssignmentPayload,
} from './types/user'
import type {
  Role,
  RoleCreatePayload,
  RoleUpdatePayload,
  RolePermissionAssignmentPayload,
} from './types/role'
import type { Permission } from './types/permission'

// Users -- all require the ADMIN role backend-side (require_role("ADMIN"),
// not require_permission -- there is no users.* permission code).
export async function listUsers(): Promise<User[]> {
  const response = await api.get<User[]>('/users')
  return response.data
}

export async function getUser(id: string): Promise<User> {
  const response = await api.get<User>(`/users/${id}`)
  return response.data
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const response = await api.post<User>('/users', payload)
  return response.data
}

export async function updateUser(
  id: string,
  payload: UserUpdatePayload,
): Promise<User> {
  const response = await api.put<User>(`/users/${id}`, payload)
  return response.data
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}

export async function assignUserRoles(
  id: string,
  payload: UserRoleAssignmentPayload,
): Promise<User> {
  const response = await api.put<User>(`/users/${id}/roles`, payload)
  return response.data
}

// Roles -- same ADMIN-role gate as Users.
export async function listRoles(): Promise<Role[]> {
  const response = await api.get<Role[]>('/roles')
  return response.data
}

export async function getRole(id: string): Promise<Role> {
  const response = await api.get<Role>(`/roles/${id}`)
  return response.data
}

export async function createRole(payload: RoleCreatePayload): Promise<Role> {
  const response = await api.post<Role>('/roles', payload)
  return response.data
}

export async function updateRole(
  id: string,
  payload: RoleUpdatePayload,
): Promise<Role> {
  const response = await api.put<Role>(`/roles/${id}`, payload)
  return response.data
}

export async function deactivateRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`)
}

export async function assignRolePermissions(
  id: string,
  payload: RolePermissionAssignmentPayload,
): Promise<Role> {
  const response = await api.put<Role>(`/roles/${id}/permissions`, payload)
  return response.data
}

// Permissions -- read-only, no create/update/delete endpoint exists.
export async function listPermissions(): Promise<Permission[]> {
  const response = await api.get<Permission[]>('/permissions')
  return response.data
}
