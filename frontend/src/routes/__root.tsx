import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { NavBar } from '../components/nav-bar'
import { TooltipProvider } from '../components/ui/tooltip'

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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-bg-void font-sans text-text-primary antialiased">
        <TooltipProvider>
          <NavBar />
          <main className="pt-16">
            <div className="container-main py-8">
              {children}
            </div>
          </main>
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  )
}
