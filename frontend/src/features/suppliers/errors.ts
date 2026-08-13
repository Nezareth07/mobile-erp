import { isAxiosError } from 'axios'

// Duplicated from features/catalog/errors.ts on purpose: importing across a
// closed feature folder would break the per-feature isolation F5 already
// established (see features/catalog/format.ts for the same precedent).

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
