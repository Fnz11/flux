import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../src/components/ui/form'
import { Input } from '../../src/components/ui/input'

type Values = { email: string }

function EmailForm({ onSubmit = vi.fn() }: { onSubmit?: (values: Values) => void }) {
  const form = useForm<Values>({ defaultValues: { email: '' } })
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormDescription>Used for receipts.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  )
}

describe('Form primitives', () => {
  it('associates the field label with its control', () => {
    render(<EmailForm />)

    expect(screen.getByLabelText('Email')).toBe(screen.getByRole('textbox', { name: 'Email' }))
  })

  it('describes the control with field help', () => {
    render(<EmailForm />)

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Used for receipts.')
  })

  it('renders validation errors after invalid submission', async () => {
    render(<EmailForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('marks an invalid control and includes its error description', async () => {
    render(<EmailForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    const input = screen.getByRole('textbox', { name: 'Email' })
    await waitFor(() => expect(input).toBeInvalid())
    expect(input).toHaveAccessibleDescription('Used for receipts. Email is required')
  })

  it('submits valid field values without an error', async () => {
    const onSubmit = vi.fn()
    render(<EmailForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'dev@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      { email: 'dev@example.com' },
      expect.anything(),
    ))
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })
})
