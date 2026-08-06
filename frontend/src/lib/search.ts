import type { SearchPair, SearchRole, SearchVault } from '@/types'

export function buildSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isManagerPair(result: unknown): result is SearchPair {
  return (
    typeof result === 'object' &&
    result !== null &&
    'symbol' in result &&
    typeof (result as SearchPair).symbol === 'string'
  )
}

export function isVaultResult(result: unknown): result is SearchVault {
  return (
    typeof result === 'object' &&
    result !== null &&
    !('symbol' in result) &&
    typeof (result as SearchVault).id === 'string'
  )
}

export function computeSuggestionRoute(
  result: SearchPair | SearchVault,
  role: SearchRole,
): string | null {
  if (isManagerPair(result)) return role === 'manager' ? '/trade' : null
  if (isVaultResult(result)) {
    return role === 'investor' && result.id.length > 0 ? `/vaults/${result.id}` : null
  }
  return null
}