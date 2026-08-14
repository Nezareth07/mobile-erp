import { isAxiosError } from 'axios'

// Duplicated from features/inventory/errors.ts (and features/suppliers,
// features/catalog before it) on purpose: importing across a closed
// feature folder would break the per-feature isolation already
// established in F5/F6/F7.

export function isForbidden(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403
}
