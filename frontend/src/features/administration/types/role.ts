import type { PermissionSummary } from './permission'

// Mirrors backend/app/modules/auth/schemas/{role_response,role_create,
// role_update,role_permission_assignment,role_summary}.py field-by-field.
export interface RoleSummary {
  id: string
  name: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  is_active: boolean
  permissions: PermissionSummary[]
  created_at: string
  updated_at: string
}

export interface RoleCreatePayload {
  name: string
  description?: string | null
}

export interface RoleUpdatePayload {
  name?: string
  description?: string | null
}

// PUT /roles/{id}/permissions replaces the role's full permission set --
// this is not an incremental add/remove.
export interface RolePermissionAssignmentPayload {
  permission_ids: string[]
}
