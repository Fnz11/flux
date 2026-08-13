import { Card } from '@/components/ui/card'

export interface RouteDetailsProps {
  inputToken: string
  outputToken: string
  slippage: number
  minReceived: number
}

export function RouteDetails({ inputToken, outputToken, slippage, minReceived }: RouteDetailsProps) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border-subtle/50 pb-2">
        Oracle & Order Route Details
      </h3>
      <div className="space-y-2.5 text-xs font-mono">
        <div className="flex justify-between py-0.5">
          <span className="text-text-tertiary font-sans">Route Pair</span>
          <span className="text-text-primary font-bold">{inputToken} / {outputToken}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-text-tertiary font-sans">Price Oracle</span>
          <span className="text-emerald-400 font-bold">Pyth Hermes Network</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-text-tertiary font-sans">Max Slippage</span>
          <span className="text-text-primary font-semibold">{slippage}%</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-text-tertiary font-sans">Min Received</span>
          <span className="text-text-primary font-bold">{minReceived > 0 ? minReceived.toFixed(4) : '0.0000'} {outputToken}</span>
        </div>
        <div className="flex justify-between py-0.5 border-t border-border-subtle/40 pt-2">
          <span className="text-text-tertiary font-sans">Estimated Network Fee</span>
          <span className="text-text-tertiary">~0.000005 SOL</span>
        </div>
      </div>
    </Card>
  )
}
