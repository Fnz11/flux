import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CreateVaultSubmitProps {
  isPending: boolean
  agreedToTerms: boolean
}

export function CreateVaultSubmit({ isPending, agreedToTerms }: CreateVaultSubmitProps) {
  return (
    <div className="pt-2">
      <Button
        type="submit"
        variant="sweep"
        size="lg"
        className="w-full text-base font-bold py-6 shadow-lg shadow-primary-coral/20 cursor-pointer"
        disabled={isPending || !agreedToTerms}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Creating Vault on Solana...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="size-5" />
            CREATE VAULT
          </span>
        )}
      </Button>
      <p className="mt-2.5 text-center text-xs text-text-tertiary">
        Requires wallet signature to initialize on-chain state account.
      </p>
    </div>
  )
}
