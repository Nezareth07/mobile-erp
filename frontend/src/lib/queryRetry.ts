import { isAxiosError } from 'axios'

const MAX_QUERY_RETRIES = 3

// HTTP 4xx responses (403 forbidden, 404 not found, 409 conflict, etc.) are
// deterministic -- the backend already decided, and retrying only delays the
// forbidden/not-found/error state every list and detail page already knows
// how to render (see each feature's `errors.ts`). Network failures and 5xx
// responses are the only cases where a retry can plausibly help, so those
// keep TanStack Query's default up-to-3-attempts behavior.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error)) {
    const status = error.response?.status

    if (status !== undefined && status >= 400 && status < 500) {
      return false
    }
  }

  return failureCount < MAX_QUERY_RETRIES
}
