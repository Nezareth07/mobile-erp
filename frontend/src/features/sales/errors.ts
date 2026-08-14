import { isAxiosError } from 'axios'

// Duplicated from features/purchases/errors.ts (and the same file in
// catalog/inventory/suppliers/customers before it) on purpose: importing
// across a closed feature folder would break the per-feature isolation
// already established since F5.

export function isForbidden(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403
}

export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404
}

export function extractErrorDetail(error: unknown, fallback: string): string {
  const detail =
    isAxiosError(error) && typeof error.response?.data?.detail === 'string'
      ? error.response.data.detail
      : null

  return detail ?? fallback
}
