import React, { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query-client'
import { Sidebar } from '../components/Sidebar'
import { TooltipProvider } from '../components/ui/tooltip'
import { WalletProvider } from '../components/providers/WalletProvider'
import { useConfigStore } from '../stores/config-store'
import { useWebSocketStore } from '../stores/websocket-store'

import { ErrorBoundary, DefaultErrorFallback } from '../components/ui/ErrorBoundary'
import { ToastContainer } from '../components/ui/ToastContainer'
import { HeroAmbient } from '../components/ui/HeroAmbient'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'FBYT - Solana Vault Platform' },
      { name: 'description', content: 'Non-custodial Solana vault investment platform' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <DefaultErrorFallback error={error as Error} onReset={reset} />
  ),
  shellComponent: RootDocument,
})

function RootBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useConfigStore.getState().fetchConfig().catch(() => {})

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws'
    try {
      useWebSocketStore.getState().connect(wsUrl)
    } catch {
      // WS connection fallback handled in store
    }
  }, [])

  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-bg-void font-sans text-text-primary antialiased relative overflow-hidden">
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <TooltipProvider>
              <ErrorBoundary>
                <RootBootstrap>
                  <div className="flex h-screen w-full overflow-hidden">
                    <Sidebar />
                    <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
                      <HeroAmbient />
                      <div className="container-main py-6 space-y-6">
                        {children}
                      </div>
                    </main>
                  </div>
                  <ToastContainer />
                </RootBootstrap>
              </ErrorBoundary>
            </TooltipProvider>
          </WalletProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

