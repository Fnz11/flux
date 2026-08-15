import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null

export function setAuthToken(token: string | null) {
  authToken = token
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }
}

export function getAuthToken(): string | null {
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token')
  }
  return authToken
}

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
  const token = getAuthToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
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

    // Clear stale / expired token on 401 so subsequent calls don't keep failing
    if (status === 401) {
      setAuthToken(null)
    }

    throw new ApiError(status, message, body?.code)
  },
)

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
    client.get<T>(url, { params }).then((res) => res.data),
  post: <T>(url: string, data?: unknown): Promise<T> =>
    client.post<T>(url, data).then((res) => res.data),
  put: <T>(url: string, data?: unknown): Promise<T> =>
    client.put<T>(url, data).then((res) => res.data),
  patch: <T>(url: string, data?: unknown): Promise<T> =>
    client.patch<T>(url, data).then((res) => res.data),
  delete: <T>(url: string): Promise<T> =>
    client.delete<T>(url).then((res) => res.data),
}
