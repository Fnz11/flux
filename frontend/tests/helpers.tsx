import React from 'react'
import { render, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '../src/components/ui/tooltip'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function TestProviders({ children, client }: { children: React.ReactNode; client?: QueryClient }) {
  const queryClient = client ?? createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: React.ReactElement,
  { client }: { client?: QueryClient } = {},
) {
  const queryClient = client ?? createTestQueryClient()
  const result = render(<TestProviders client={queryClient}>{ui}</TestProviders>)
  return { ...result, queryClient }
}

export function renderHookWithProviders<Result, Props>(
  hook: (props: Props) => Result,
  options: { client?: QueryClient; initialProps?: Props } = {},
) {
  const queryClient = options.client ?? createTestQueryClient()
  const result = renderHook(hook, {
    initialProps: options.initialProps,
    wrapper: ({ children }) => <TestProviders client={queryClient}>{children}</TestProviders>,
  })
  return { ...result, queryClient }
}