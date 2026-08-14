// Mirrors backend/app/modules/auth/schemas/user_password_change.py
// (UserPasswordChange) field-by-field.
export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}
