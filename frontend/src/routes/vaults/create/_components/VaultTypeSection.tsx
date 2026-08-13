import { Globe, Lock } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { VaultTypeCard } from './VaultTypeCard'
import type { VaultType } from '@/constants/vault'

export interface VaultTypeSectionProps {
  value: VaultType
  onSelect: (type: VaultType) => void
}

export function VaultTypeSection({ value, onSelect }: VaultTypeSectionProps) {
  return (
    <SectionCard
      icon={<Globe className="size-4 text-primary-coral" />}
      title="01. Vault Type"
      description="Choose how investors can enter and redeem capital from your vault."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VaultTypeCard
          type="open"
          selected={value === 'open'}
          onSelect={onSelect}
          icon={<Globe className="size-5" />}
          iconClassName="bg-primary-coral/10 text-primary-coral"
          title="Open-ended"
          badge="Flexible"
          badgeClassName="text-[10px] font-medium bg-primary-coral/10 text-primary-coral px-2 py-0.5 rounded-full border border-primary-coral/20"
          description="Investors can deposit and redeem funds at any time based on real-time net asset value (NAV)."
        />
        <VaultTypeCard
          type="closed"
          selected={value === 'closed'}
          onSelect={onSelect}
          icon={<Lock className="size-5" />}
          iconClassName="bg-bg-elevated text-text-tertiary border border-border-subtle"
          title="Closed-end"
          badge="Fixed Term"
          badgeClassName="text-[10px] font-medium bg-bg-inset text-text-tertiary px-2 py-0.5 rounded-full border border-border-subtle"
          description="Fixed investment term. Deposits are accepted only during the fundraising window."
        />
      </div>
    </SectionCard>
  )
}
