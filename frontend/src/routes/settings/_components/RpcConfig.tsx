import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RPC_ENDPOINTS } from './rpcEndpoints'

export function RpcConfig() {
  const [rpcUrl, setRpcUrl] = useState(RPC_ENDPOINTS[1].url)

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Server className="size-5 text-primary-coral" />
        <h2 className="text-base font-semibold text-text-primary">RPC Cluster Configuration</h2>
      </div>
      <div className="space-y-3">
        <Label className="text-xs text-text-tertiary">Target Network RPC</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {RPC_ENDPOINTS.map((endpoint) => (
            <Button
              key={endpoint.url}
              variant="outline"
              onClick={() => setRpcUrl(endpoint.url)}
              className={cn(
                'h-auto flex-col items-start p-3 text-left transition-all font-normal',
                rpcUrl === endpoint.url
                  ? 'border-primary-coral bg-primary-coral/10 text-text-primary hover:bg-primary-coral/20'
                  : 'border-border-subtle bg-bg-inset text-text-secondary hover:border-border-medium hover:bg-bg-inset',
              )}
            >
              <p className="text-xs font-medium">{endpoint.name}</p>
              <p className="mt-1 font-mono text-[10px] text-text-tertiary truncate w-full">{endpoint.url}</p>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
