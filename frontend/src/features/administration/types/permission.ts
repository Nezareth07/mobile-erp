// Mirrors backend/app/modules/auth/schemas/permission_response.py and
// permission_summary.py. Permissions have no is_active field -- they are
// not soft-deletable (confirmed: PermissionResponse carries no such
// field, and there is no DELETE /permissions endpoint).
export interface PermissionSummary {
  id: string
  code: string
}

export interface Permission {
  id: string
  code: string
  description: string | null
  created_at: string
}
