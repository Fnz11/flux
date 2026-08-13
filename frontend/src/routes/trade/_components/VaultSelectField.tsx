import type { Vault } from '@/types'
import { FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/EmptyState'

export interface VaultSelectFieldProps {
  vaults: Vault[]
  isLoading: boolean
  onVaultChange: (value: string) => void
}

export function VaultSelectField({ vaults, isLoading, onVaultChange }: VaultSelectFieldProps) {
  return (
    <FormField
      name="vaultId"
      render={({ field }) => (
        <FormItem className="m-0 space-y-0">
          <FormControl>
            <Select
              value={field.value || ''}
              onValueChange={onVaultChange}
              disabled={isLoading || vaults.length === 0}
            >
              <SelectTrigger id="vault-select" className="h-8 w-44 rounded-xl border border-border-subtle bg-bg-inset px-3 text-xs font-semibold text-text-primary hover:border-primary-coral/40 cursor-pointer">
                {isLoading ? (
                  <div className="h-4 w-28 animate-pulse rounded-md bg-bg-inset" />
                ) : (
                  <SelectValue placeholder={vaults.length === 0 ? "No vaults available" : "Select vault..."}>
                    {vaults.find((v) => v.id === field.value)?.metadata?.displayName || (vaults.length === 0 ? "No vaults available" : "Select vault...")}
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[11rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
                {vaults.length === 0 ? (
                  <EmptyState size="xs" title="No vaults available" />
                ) : (
                  vaults.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                      {v.metadata.displayName || `Vault ${v.id.slice(0, 8)}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
