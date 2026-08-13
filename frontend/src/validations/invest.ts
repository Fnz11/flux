import { z } from 'zod'

export const depositSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num > 0
    }, { message: 'Amount must be greater than 0' }),
})

export type DepositFormValues = z.infer<typeof depositSchema>

export const withdrawSchema = z.object({
  shareAmount: z
    .string()
    .min(1, 'Share amount is required')
    .refine((val) => {
      const num = Number(val)
      return !isNaN(num) && num > 0
    }, { message: 'Amount must be greater than 0' }),
})

export type WithdrawFormValues = z.infer<typeof withdrawSchema>
