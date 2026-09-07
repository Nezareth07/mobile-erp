import { describe, expect, it } from 'vitest'
import { shouldRetryQuery } from './queryRetry'

// Mirrors exactly what axios's own `isAxiosError` checks for (`isAxiosError
// === true` on the payload) -- see https://github.com/axios/axios. Building
// a minimal fake here keeps these tests fast and independent of network
// timing instead of waiting out real TanStack Query backoff delays.
function fakeAxiosError(status?: number): unknown {
  return {
    isAxiosError: true,
    response: status === undefined ? undefined : { status },
  }
}

describe('shouldRetryQuery', () => {
  it('does not retry a 403 Forbidden response', () => {
    const error = fakeAxiosError(403)

    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does not retry a 404 Not Found response', () => {
    const error = fakeAxiosError(404)

    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does not retry a 409 Conflict response', () => {
    const error = fakeAxiosError(409)

    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('does not retry a 400 Bad Request response, even on the first failure', () => {
    const error = fakeAxiosError(400)

    expect(shouldRetryQuery(0, error)).toBe(false)
  })

  it('retries a 500 Internal Server Error up to the default cap', () => {
    const error = fakeAxiosError(500)

    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(1, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(false)
  })

  it('retries a 503 Service Unavailable response up to the default cap', () => {
    const error = fakeAxiosError(503)

    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(false)
  })

  it('retries a network error (no response at all) up to the default cap', () => {
    const error = fakeAxiosError(undefined)

    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(false)
  })

  it('falls back to the default cap for a non-axios error', () => {
    const error = new Error('unexpected')

    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(3, error)).toBe(false)
  })
})
