import { describe, expect, it } from 'vitest'
import { decodeAccessTokenSubject } from './jwt'

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildToken(payload: Record<string, unknown>): string {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = encodeBase64Url(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

describe('decodeAccessTokenSubject', () => {
  it('extracts the sub claim from a well-formed token', () => {
    const token = buildToken({ sub: 'abc-123', type: 'access' })
    expect(decodeAccessTokenSubject(token)).toBe('abc-123')
  })

  it('returns null for a token with fewer than 3 segments', () => {
    expect(decodeAccessTokenSubject('not-a-jwt')).toBeNull()
  })

  it('returns null when the payload segment is not valid base64', () => {
    expect(decodeAccessTokenSubject('a.!!!invalid!!!.c')).toBeNull()
  })

  it('returns null when sub is missing or not a string', () => {
    const token = buildToken({ type: 'access' })
    expect(decodeAccessTokenSubject(token)).toBeNull()
  })

  it('returns null when the payload is not valid JSON', () => {
    const token = `${encodeBase64Url('{}')}.${encodeBase64Url('not-json')}.sig`
    expect(decodeAccessTokenSubject(token)).toBeNull()
  })
})
