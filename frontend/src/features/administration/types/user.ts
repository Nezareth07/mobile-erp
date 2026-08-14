import type { RoleSummary } from './role'

// Mirrors backend/app/modules/auth/schemas/{user_response,user_create,
// user_update,user_role_assignment}.py field-by-field.
export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  roles: RoleSummary[]
  created_at: string
  updated_at: string
}

export interface UserCreatePayload {
  email: string
  full_name: string
  password: string
  role_ids: string[]
}

export interface UserUpdatePayload {
  email?: string
  full_name?: string
}

// PUT /users/{id}/roles replaces the user's full role set -- this is not
// an incremental add/remove.
export interface UserRoleAssignmentPayload {
  role_ids: string[]
}
