import { useMutation } from '@tanstack/react-query'
import { changePassword } from '../api'
import type { ChangePasswordPayload } from '../types/account'

export function useChangePassword(userId: string | null) {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => {
      if (!userId) {
        return Promise.reject(new Error('No authenticated user id.'))
      }
      return changePassword(userId, payload)
    },
  })
}
