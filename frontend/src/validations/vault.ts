import { z } from 'zod'

export const vaultsSearchSchema = z.object({
  status: z.enum(['All', 'Fundraising', 'Active', 'Dormant']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['displayName', 'pnl', 'created_at', 'min_raise_amount', 'investors', 'tvl']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

export type VaultsSearchValues = z.infer<typeof vaultsSearchSchema>

export const editVaultSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(64),
  description: z.string().max(500).optional(),
  coverImageUrl: z.string().optional(),
  focusAssets: z.array(z.string()).min(1, 'Select at least one asset').max(100, 'Max 100 assets allowed'),
  tags: z.string().optional(),
})

export type EditVaultForm = z.infer<typeof editVaultSchema>

export const createVaultSchema = z.object({
  vaultType: z.enum(['open', 'closed']),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50, 'Max 50 characters'),
  description: z.string().max(500, 'Max 500 characters').optional(),
  coverImageUrl: z.string().optional(),
  focusAssets: z.array(z.string()).max(100, 'Max 100 assets allowed').optional(),
  tags: z.array(z.string()).optional(),
  minRaiseAmount: z.number().min(0, 'Min raise must be ≥ 0'),
  minRaiseUnit: z.enum(['SOL', 'USDC', 'USDT']),
  acceptedAssets: z.array(z.string()).min(1, 'Select at least one accepted asset'),
  minInvestment: z.number().min(0.001, 'Min investment must be ≥ 0.001'),
  lockupPeriodValue: z.number().min(0, 'Lockup period must be ≥ 0'),
  lockupPeriodUnit: z.enum(['hours', 'days']),
  managementFeePercent: z.number().min(0, 'Min 0%').max(15, 'Management fee cannot exceed 15%'),
  feeWithdrawalPeriod: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  performanceFeePercent: z.number().min(0, 'Min 0%').max(20, 'Performance fee cannot exceed 20%'),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
})

export type CreateVaultFormValues = z.infer<typeof createVaultSchema>
