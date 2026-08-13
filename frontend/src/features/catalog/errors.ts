import { isAxiosError } from 'axios'

// Same pattern already used by LoginPage (err.response?.data?.detail) and
// DashboardPage (403 detection) -- extracted here because this feature
// repeats both checks across 3 entities' create/update/delete flows.

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
