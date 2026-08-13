import { afterEach, describe, expect, it } from 'vitest'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './authStorage'

describe('authStorage', () => {
  afterEach(() => {
    clearTokens()
  })

  it('returns null when no tokens are stored', () => {
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('persists and retrieves both tokens', () => {
    setTokens('access-123', 'refresh-456')

    expect(getAccessToken()).toBe('access-123')
    expect(getRefreshToken()).toBe('refresh-456')
  })

  it('clears both tokens', () => {
    setTokens('access-123', 'refresh-456')

    clearTokens()

    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
