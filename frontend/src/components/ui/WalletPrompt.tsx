import { SectionCard } from './SectionCard'
import { EmptyState } from './EmptyState'
import { WalletConnectButton } from './WalletConnectButton'
import { Wallet } from 'lucide-react'

export interface WalletPromptProps {
  title?: string
  description?: string
  className?: string
}

export function WalletPrompt({
  title = 'Connect Your Wallet',
  description = 'Please connect your wallet to view this section.',
  className,
}: WalletPromptProps) {
  return (
    <SectionCard className={className}>
      <div className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 p-6 flex flex-col items-center">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title={title}
          description={description}
          size="md"
        />
        <div className="mt-4 flex justify-center">
          <WalletConnectButton />
        </div>
      </div>
    </SectionCard>
  )
}
