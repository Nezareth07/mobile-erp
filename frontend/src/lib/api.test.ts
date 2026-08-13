import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { api, setUnauthorizedHandler } from './api'
import { clearTokens, getAccessToken, setTokens } from '../auth/authStorage'

const BASE_URL = 'http://localhost:8000/api/v1'

let refreshCallCount = 0
let probeCallCount = 0

function unauthorized(detail: string) {
  return HttpResponse.json({ detail }, { status: 401 })
}

const server = setupServer(
  http.post(`${BASE_URL}/auth/refresh`, async () => {
    refreshCallCount += 1
    return HttpResponse.json({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
      expires_in: 1800,
    })
  }),
  http.get(`${BASE_URL}/probe`, ({ request }) => {
    probeCallCount += 1
    const authHeader = request.headers.get('authorization')

    if (authHeader === 'Bearer new-access-token') {
      return HttpResponse.json({ ok: true })
    }

    return unauthorized('Could not validate credentials.')
  }),
  http.post(`${BASE_URL}/auth/login`, () =>
    unauthorized('Invalid email or password.'),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  refreshCallCount = 0
  probeCallCount = 0
  clearTokens()
  setUnauthorizedHandler(null)
})
afterAll(() => server.close())

describe('api request interceptor', () => {
  it('attaches the Authorization header when an access token is stored', async () => {
    setTokens('valid-access-token', 'valid-refresh-token')
    server.use(
      http.get(`${BASE_URL}/probe`, ({ request }) => {
        probeCallCount += 1
        return HttpResponse.json({
          received: request.headers.get('authorization'),
        })
      }),
    )

    const response = await api.get('/probe')

    expect(response.data.received).toBe('Bearer valid-access-token')
    expect(probeCallCount).toBe(1)
  })

  it('omits the Authorization header when no token is stored', async () => {
    server.use(
      http.get(`${BASE_URL}/probe`, ({ request }) => {
        return HttpResponse.json({
          received: request.headers.get('authorization'),
        })
      }),
    )

    const response = await api.get('/probe')

    expect(response.data.received).toBeNull()
  })
})

describe('api response interceptor — single refresh + retry', () => {
  it('refreshes once on a single 401 and retries the original request', async () => {
    setTokens('expired-access-token', 'valid-refresh-token')

    const response = await api.get('/probe')

    expect(response.status).toBe(200)
    expect(response.data).toEqual({ ok: true })
    expect(refreshCallCount).toBe(1)
    expect(getAccessToken()).toBe('new-access-token')
  })

  it('concurrent 401s trigger exactly one refresh and all original requests retry successfully', async () => {
    setTokens('expired-access-token', 'valid-refresh-token')

    const [a, b, c] = await Promise.all([
      api.get('/probe'),
      api.get('/probe'),
      api.get('/probe'),
    ])

    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(c.status).toBe(200)
    expect(refreshCallCount).toBe(1)
    // 3 initial 401s + 3 successful retries.
    expect(probeCallCount).toBe(6)
    expect(getAccessToken()).toBe('new-access-token')
  })

  it('logs out without looping when the refresh call itself fails', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshCallCount += 1
        return unauthorized('Invalid or expired refresh token.')
      }),
    )
    setTokens('expired-access-token', 'stale-refresh-token')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await expect(api.get('/probe')).rejects.toBeTruthy()

    expect(refreshCallCount).toBe(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
  })

  it('does not retry a request that already failed once after a refresh', async () => {
    server.use(
      http.get(`${BASE_URL}/probe`, () => {
        probeCallCount += 1
        return unauthorized('Could not validate credentials.')
      }),
    )
    setTokens('expired-access-token', 'valid-refresh-token')
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await expect(api.get('/probe')).rejects.toBeTruthy()

    expect(refreshCallCount).toBe(1)
    // 1 initial 401 + 1 retry that also 401s — never a third attempt.
    expect(probeCallCount).toBe(2)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
  })

  it('does not intercept 401s coming from /auth/login itself', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)

    await expect(
      api.post('/auth/login', { email: 'x@x.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(refreshCallCount).toBe(0)
    expect(handler).not.toHaveBeenCalled()
  })
})
