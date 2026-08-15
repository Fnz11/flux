import { api, setAuthToken } from '@/lib/api'

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

export function getCachedAuthToken(walletAddress?: string): string | null {
  try {
    if (walletAddress) {
      const token = localStorage.getItem(`flux_auth_${walletAddress}`)
      if (token) return token
    }
    return localStorage.getItem('auth_token')
  } catch {
    return null
  }
}

export async function ensureWalletAuthenticated(
  walletAddress: string,
  signMessageFn?: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<string | null> {
  const cached = getCachedAuthToken(walletAddress)
  if (cached) {
    setAuthToken(cached)
    return cached
  }

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
