import { useQuery } from '@tanstack/react-query'
import {
  getGlobalTransactions,
  type GlobalTransactionParams,
} from '@/services/apis/rest-api/transactions.service'

export function useGlobalTransactionsQuery(params?: GlobalTransactionParams) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => getGlobalTransactions(params),
    enabled: Boolean(params?.wallet),
  })
}