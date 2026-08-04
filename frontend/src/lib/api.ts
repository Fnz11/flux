import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

let authToken: string | null = null

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authInterceptor(config: InternalAxiosRequestConfig) {
  if (authToken && config.headers) {
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use(authInterceptor)

client.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string; code?: string }>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data
    const message = body?.error ?? error.message ?? 'Unknown error'
    throw new ApiError(status, message, body?.code)
  },
)

// Backward-compatible `api` object for existing stores
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  return headers
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...buildHeaders(), ...(options?.headers as Record<string, string>) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body?.error ?? res.statusText)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export default client
