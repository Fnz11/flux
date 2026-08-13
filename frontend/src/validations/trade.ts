import { z } from 'zod'

export const tradeSearchSchema = z.object({
  vaultId: z.string().optional(),
})

export type TradeSearchValues = z.infer<typeof tradeSearchSchema>

export const swapSchema = z.object({
  vaultId: z.string().min(1, 'Please select a vault'),
  inputAmount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than 0',
    }),
  slippage: z
    .number()
    .min(0.01, 'Slippage must be at least 0.01%')
    .max(100, 'Slippage cannot exceed 100%'),
})

export type SwapFormValues = z.infer<typeof swapSchema>

export const tradePreferencesSchema = z.object({
  slippageBps: z
    .string()
    .min(1, 'Slippage is required')
    .refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num >= 1 && num <= 10000
    }, { message: 'Slippage must be between 1 and 10000 BPS' }),
  dustThreshold: z
    .string()
    .min(1, 'Dust threshold is required')
    .refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num >= 0
    }, { message: 'Dust threshold must be a valid non-negative number' }),
})

export type TradePreferencesFormValues = z.infer<typeof tradePreferencesSchema>
