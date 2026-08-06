import '@/lib/buffer-polyfill'
import React, { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query-client'
import { Sidebar } from '../components/Sidebar'
import { MobileNav } from '../components/MobileNav'
import { TooltipProvider } from '../components/ui/tooltip'
import { WalletProvider } from '../components/providers/WalletProvider'
import { useConfigStore } from '../stores/config-store'
import { useWebSocketStore } from '../stores/websocket-store'

import { ErrorBoundary, DefaultErrorFallback } from '../components/ui/ErrorBoundary'
import { NotFoundPage } from '../components/ui/NotFoundPage'
import { Toaster } from 'react-hot-toast'
import { HeroAmbient } from '../components/ui/HeroAmbient'

import appCss from '../styles.css?url'

import { generateMetadata } from '../lib/metadata'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...generateMetadata(),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <DefaultErrorFallback error={error as Error} onReset={reset} />
  ),
  notFoundComponent: NotFoundPage,
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
                    <MobileNav />
                    <main className="relative flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
                      <HeroAmbient />
                      <div className="container-main py-6 space-y-6">
                        {children}
                      </div>
                    </main>
                  </div>
                  <Toaster
                    position="bottom-right"
                    gutter={8}
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: 'rgba(18, 18, 22, 0.62)',
                        backdropFilter: 'blur(24px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                        color: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        fontWeight: 500,
                        padding: '8px 12px',
                        fontSize: '13px',
                        lineHeight: '18px',
                        maxWidth: '340px',
                        minWidth: '0',
                      },
                    }}
                  />
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

