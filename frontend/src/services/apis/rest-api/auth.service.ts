import { api, getAuthToken, setAuthToken } from '@/lib/api'

export interface NonceResponse {
  nonce: string
}

export interface VerifyResponse {
  token: string
  wallet_address: string
}

export async function requestNonce(walletAddress: string): Promise<string> {
  const res = await api.post<NonceResponse>('/auth/nonce', { wallet_address: walletAddress })
  return res.nonce
}

export async function verifySignature(walletAddress: string, signatureBase64: string): Promise<string> {
  const res = await api.post<VerifyResponse>('/auth/verify', {
    wallet_address: walletAddress,
    signature: signatureBase64,
  })
  if (res.token) {
    setAuthToken(res.token)
    try {
      localStorage.setItem(`flux_auth_${walletAddress}`, res.token)
    } catch {}
  }
  return res.token
}

/** Decode a JWT and return its exp claim (seconds), or null if undecodable. */
function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** Returns true if the token is missing, malformed, or within 60s of expiry. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  const exp = getTokenExp(token)
  if (exp === null) return true
  // Treat token as expired 60 seconds early to avoid clock-skew races
  return Date.now() / 1000 >= exp - 60
}

export function getCachedAuthToken(walletAddress?: string): string | null {
  try {
    if (walletAddress) {
      const token = localStorage.getItem(`flux_auth_${walletAddress}`)
      if (token && !isTokenExpired(token)) return token
      // Clean up expired wallet-specific token
      if (token) localStorage.removeItem(`flux_auth_${walletAddress}`)
    }
    const fallback = localStorage.getItem('auth_token')
    if (fallback && !isTokenExpired(fallback)) return fallback
    // Clean up expired global token
    if (fallback) localStorage.removeItem('auth_token')
    return null
  } catch {
    return null
  }
}

export async function ensureWalletAuthenticated(
  walletAddress: string,
  signMessageFn?: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<string | null> {
  // Re-auth if the cached token is missing OR expired
  const cached = getCachedAuthToken(walletAddress)
  if (cached) {
    setAuthToken(cached)
    return cached
  }

  // Clear any stale expired token from memory before re-authing
  setAuthToken(null)

  if (!signMessageFn) {
    return null
  }

  try {
    const nonce = await requestNonce(walletAddress)
    const messageBytes = new TextEncoder().encode(nonce)
    const signatureBytes = await signMessageFn(messageBytes)
    const signatureBase64 = btoa(
      String.fromCharCode.apply(null, Array.from(signatureBytes)),
    )
    const token = await verifySignature(walletAddress, signatureBase64)
    return token
  } catch (err) {
    console.warn('Wallet authentication failed:', err)
    return null
  }
}

