import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultStore, useConfigStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ArrowDownUp } from 'lucide-react'
import { TokenSelector } from './TokenSelector'
import { PriceDisplay } from './PriceDisplay'
import { ConfirmationDialog } from './ConfirmationDialog'
import { usePythPrice } from '@/hooks/usePythPrice'
import { useExecuteTrade } from '@/hooks/useExecuteTrade'
import type { PriceState } from './PriceDisplay'

interface SwapFormProps {
  preselectedVaultId?: string
}

export function SwapForm({ preselectedVaultId }: SwapFormProps) {
  const wallet = useWallet()
  const vaults = useVaultStore((s) => s.vaults)
  const config = useConfigStore((s) => s.config)

  const [vaultId, setVaultId] = useState(preselectedVaultId ?? '')
  const [inputToken, setInputToken] = useState('SOL')
  const [outputToken, setOutputToken] = useState('USDC')
  const [inputAmount, setInputAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [showConfirm, setShowConfirm] = useState(false)

  const { execute, isLoading: isExecuting } = useExecuteTrade()

  const pythPriceFeedId = `${inputToken}/${outputToken}`
  const priceData: PriceState = usePythPrice(pythPriceFeedId)

  const tokens = config?.focusAssetsWhitelist ?? ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH']

  const inputNum = parseFloat(inputAmount) || 0
  const rate = priceData.status === 'live' || priceData.status === 'stale' ? priceData.price : 0
  const outputAmount = inputNum * rate
  const minReceived = outputAmount * (1 - slippage / 100)

  const handleSwap = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!vaultId || !inputNum) return
    await execute({
      vaultId,
      inputToken,
      outputToken,
      amountIn: inputNum,
      amountOut: outputAmount,
      priceAtExecution: rate,
      slippage,
    })
    setShowConfirm(false)
  }, [vaultId, inputNum, inputToken, outputToken, outputAmount, rate, slippage, execute])

  const toggleDirection = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-3">
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Swap</h2>

          <div className="space-y-3">
            <div>
              <Label htmlFor="vault-select" className="mb-1 block text-xs text-text-tertiary">Vault</Label>
              <Select value={vaultId} onValueChange={setVaultId}>
                <SelectTrigger id="vault-select" className="w-full">
                  <SelectValue placeholder="Select vault..." />
                </SelectTrigger>
                <SelectContent>
                  {vaults.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.metadata.displayName || v.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl bg-bg-inset p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="pay-amount" className="text-xs text-text-tertiary">You pay</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputAmount(inputAmount === '' ? '0' : '')}
                >
                  Max
                </Button>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  id="pay-amount"
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent font-mono text-xl border-0 h-auto p-0 focus-visible:ring-0"
                />
                <TokenSelector
                  tokens={tokens}
                  selected={inputToken}
                  onSelect={setInputToken}
                />
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDirection}
                aria-label="Swap direction"
              >
                <ArrowDownUp className="size-4" />
              </Button>
            </div>

            <div className="rounded-xl bg-bg-inset p-4">
              <Label className="text-xs text-text-tertiary">You receive</Label>
              <div className="mt-1 flex items-center gap-3">
                <p className="flex-1 font-mono text-xl text-text-primary">
                  {outputAmount > 0 ? outputAmount.toFixed(6) : '0.00'}
                </p>
                <TokenSelector
                  tokens={tokens}
                  selected={outputToken}
                  onSelect={setOutputToken}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="custom-slippage" className="mb-1 block text-xs text-text-tertiary">Slippage (%)</Label>
              <div className="flex gap-2">
                {[0.1, 0.5, 1.0, 2.0].map((s) => (
                  <Button
                    key={s}
                    variant={slippage === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSlippage(s)}
                  >
                    {s}%
                  </Button>
                ))}
                <Input
                  id="custom-slippage"
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-16 px-2 py-1.5 text-xs h-auto"
                />
              </div>
            </div>
          </div>

          <Button
            variant="default"
            className="mt-5 w-full"
            onClick={handleSwap}
            disabled={!vaultId || !inputNum || !wallet.connected || isExecuting}
          >
            {isExecuting ? 'Swapping...' : !wallet.connected ? 'Connect Wallet' : 'Execute Swap'}
          </Button>

          <ConfirmationDialog
            open={showConfirm}
            onConfirm={handleConfirm}
            onClose={() => setShowConfirm(false)}
            inputToken={inputToken}
            outputToken={outputToken}
            inputAmount={inputNum}
            outputAmount={outputAmount}
            rate={rate}
            slippage={slippage}
            minReceived={minReceived}
            networkFee={0.000005}
            isLoading={isExecuting}
          />
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <PriceDisplay data={priceData} />
      </div>
    </div>
  )
}
