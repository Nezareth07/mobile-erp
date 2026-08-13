import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '../auth/authStorage'

const DEV_FALLBACK_BASE_URL = 'http://localhost:8000/api/v1'

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? DEV_FALLBACK_BASE_URL : undefined)

export const api = axios.create({
  baseURL,
})

const AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/refresh'])

function isAuthEndpoint(url?: string): boolean {
  return url !== undefined && AUTH_ENDPOINTS.has(url)
}

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean
}

// Single-flight refresh: while a refresh is in progress, every concurrent
// 401 awaits this same promise instead of firing its own POST /auth/refresh.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    throw new Error('No refresh token available.')
  }

  // Plain axios (not `api`) so this call never goes through the request/
  // response interceptors below and can never trigger its own refresh.
  const response = await axios.post(`${baseURL}/auth/refresh`, {
    refresh_token: refreshToken,
  })

  const { access_token, refresh_token } = response.data
  setTokens(access_token, refresh_token)
  return access_token
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    if (isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error)
    }

    if (originalRequest._retry) {
      clearTokens()
      onUnauthorized?.()
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }

      // Wait for the (possibly shared) refresh to finish. We don't need its
      // return value here: re-submitting through `api()` re-enters the
      // request interceptor above, which reads the freshly stored token.
      await refreshPromise

      return api(originalRequest)
    } catch {
      clearTokens()
      onUnauthorized?.()
      return Promise.reject(error)
    }
  },
)
