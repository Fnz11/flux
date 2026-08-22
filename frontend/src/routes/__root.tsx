import '@/lib/buffer-polyfill'
import { createRootRoute } from '@tanstack/react-router'
import { DefaultErrorFallback } from '../components/ui/ErrorBoundary'
import { NotFoundPage } from '../components/ui/NotFoundPage'
import { RootDocument } from '../components/layout/RootDocument'
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
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <DefaultErrorFallback error={error as Error} onReset={reset} />
  ),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
})
