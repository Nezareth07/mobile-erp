import { isAxiosError } from 'axios'

// Duplicated from features/suppliers/errors.ts (and features/catalog/errors.ts
// before it) on purpose: importing across a closed feature folder would
// break the per-feature isolation already established in F5/F6.

export function isForbidden(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 403
}

export function extractErrorDetail(error: unknown, fallback: string): string {
  const detail =
    isAxiosError(error) && typeof error.response?.data?.detail === 'string'
      ? error.response.data.detail
      : null

  return detail ?? fallback
}
