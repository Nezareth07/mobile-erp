// Decodes (without verifying) the `sub` claim of a JWT access token. The
// backend has no `/users/me` endpoint (confirmed by direct router audit,
// F11), so this is the only client-side way to know "who am I" for
// self-service actions like changing your own password. Signature/expiry
// are never checked here -- the backend remains the sole authority and
// will reject the token on the actual request if it's invalid or expired.
export function decodeAccessTokenSubject(token: string): string | null {
  const parts = token.split('.')

  if (parts.length !== 3) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      '=',
    )
    const decoded = atob(padded)
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const claims = JSON.parse(json) as { sub?: unknown }

    return typeof claims.sub === 'string' ? claims.sub : null
  } catch {
    return null
  }
}
