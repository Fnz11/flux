export interface MetadataOptions {
  title?: string
  description?: string
  keywords?: string | string[]
  image?: string
  path?: string
  noIndex?: boolean
  type?: 'website' | 'article' | 'profile'
}

export const SITE_CONFIG = {
  siteName: 'Flux',
  titleTemplate: '%s | Flux - Solana Vault Platform',
  defaultTitle: 'Flux - Non-Custodial Solana Vault Investment Platform',
  defaultDescription:
    'Flux is a non-custodial Solana investment platform empowering users to manage and deposit into algorithmic trading vaults with real-time PnL, Pyth oracles, and transparent fee sharing.',
  defaultKeywords: [
    'Solana',
    'DeFi',
    'Vaults',
    'Yield',
    'Trading',
    'Non-Custodial',
    'Pyth Network',
    'Solana Vaults',
    'Asset Management',
  ],
  siteUrl: 'https://flux.io',
  defaultImage: '/logo.png',
  twitterHandle: '@flux_platform',
  themeColor: '#FA9A63',
}

export function generateMetadata(options: MetadataOptions = {}) {
  const {
    title,
    description = SITE_CONFIG.defaultDescription,
    keywords = SITE_CONFIG.defaultKeywords,
    image = SITE_CONFIG.defaultImage,
    path = '',
    noIndex = false,
    type = 'website',
  } = options

  const formattedTitle = title
    ? SITE_CONFIG.titleTemplate.replace('%s', title)
    : SITE_CONFIG.defaultTitle

  const keywordsString = Array.isArray(keywords) ? keywords.join(', ') : keywords
  const canonicalUrl = `${SITE_CONFIG.siteUrl}${path}`
  const fullImageUrl = image.startsWith('http') ? image : `${SITE_CONFIG.siteUrl}${image}`

  const meta: Array<Record<string, string>> = [
    // Standard Meta
    { title: formattedTitle },
    { name: 'description', content: description },
    { name: 'keywords', content: keywordsString },
    { name: 'application-name', content: SITE_CONFIG.siteName },
    { name: 'theme-color', content: SITE_CONFIG.themeColor },

    // Robots & Indexing
    {
      name: 'robots',
      content: noIndex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    },

    // OpenGraph / Facebook
    { property: 'og:site_name', content: SITE_CONFIG.siteName },
    { property: 'og:type', content: type },
    { property: 'og:title', content: formattedTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: fullImageUrl },
    { property: 'og:locale', content: 'en_US' },

    // Twitter Cards
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: SITE_CONFIG.twitterHandle },
    { name: 'twitter:creator', content: SITE_CONFIG.twitterHandle },
    { name: 'twitter:title', content: formattedTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: fullImageUrl },
  ]

  return meta
}
