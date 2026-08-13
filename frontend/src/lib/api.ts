import axios from 'axios'

const DEV_FALLBACK_BASE_URL = 'http://localhost:8000/api/v1'

const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? DEV_FALLBACK_BASE_URL : undefined)

export const api = axios.create({
  baseURL,
})
