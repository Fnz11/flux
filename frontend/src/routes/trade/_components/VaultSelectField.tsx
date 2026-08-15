import type { Vault } from '@/types'
import { FormField, FormItem, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/EmptyState'
import { Lock } from 'lucide-react'

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
                    {(() => {
                      const sel = vaults.find((v) => v.id === field.value)
                      if (!sel) return vaults.length === 0 ? "No vaults available" : "Select vault..."
                      const isFundraising = sel.status?.toLowerCase() === 'fundraising'
                      return (
                        <span className="flex items-center gap-1.5 truncate">
                          {isFundraising && <Lock className="size-3 text-status-warning shrink-0" />}
                          <span className="truncate">{sel.metadata?.displayName || `Vault ${sel.id.slice(0, 8)}`}</span>
                        </span>
                      )
                    })()}
                  </SelectValue>
                )}
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[13rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
                {vaults.length === 0 ? (
                  <EmptyState size="xs" title="No vaults available" />
                ) : (
                  vaults.map((v) => {
                    const isFundraising = v.status?.toLowerCase() === 'fundraising'
                    return (
                      <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{v.metadata.displayName || `Vault ${v.id.slice(0, 8)}`}</span>
                          {isFundraising ? (
                            <span className="flex items-center gap-1 text-[10px] text-status-warning bg-status-warning/10 px-1.5 py-0.5 rounded border border-status-warning/20 shrink-0">
                              <Lock className="size-2.5" />
                              Fundraising
                            </span>
                          ) : (
                            <span className="text-[10px] text-status-success bg-status-success/10 px-1.5 py-0.5 rounded border border-status-success/20 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })
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
