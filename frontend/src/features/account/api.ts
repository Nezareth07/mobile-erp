import { api } from '../../lib/api'
import type { ChangePasswordPayload } from './types/account'

// PUT /users/{id}/password requires no permission beyond being the
// authenticated user changing their own password (enforced server-side:
// the router 403s if id !== current_user.id). There is no /users/me
// endpoint, so the caller must supply its own id (see auth/jwt.ts).
export async function changePassword(
  userId: string,
  payload: ChangePasswordPayload,
): Promise<void> {
  await api.put(`/users/${userId}/password`, payload)
}
