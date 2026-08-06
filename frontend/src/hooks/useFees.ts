import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getAccruedFees } from '@/services/apis/rest-api/fee.service'
import type { ApiFee } from '@/types'

export function useFees(vaultIds: string[]): {
  fees: ApiFee[]
  totalFees: number
  totalPerf: number
  totalMgmt: number
  isLoading: boolean
} {
  const uniqueVaultIds = useMemo(() => Array.from(new Set(vaultIds.filter(Boolean))), [vaultIds])

  const queries = useQueries({
    queries: uniqueVaultIds.map((id) => ({
      queryKey: ['fees', id],
      queryFn: () => getAccruedFees(id),
      enabled: Boolean(id),
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)

  const fees = useMemo(() => {
    return queries.map((q) => q.data).filter((f): f is ApiFee => Boolean(f))
  }, [queries])

  const totalFees = useMemo(() => fees.reduce((acc, f) => acc + (f.total_accrued || 0), 0), [fees])
  const totalPerf = useMemo(
    () => fees.reduce((acc, f) => acc + (f.accrued_performance_fee || 0), 0),
    [fees],
  )
  const totalMgmt = useMemo(
    () => fees.reduce((acc, f) => acc + (f.accrued_management_fee || 0), 0),
    [fees],
  )

  return { fees, totalFees, totalPerf, totalMgmt, isLoading }
}
