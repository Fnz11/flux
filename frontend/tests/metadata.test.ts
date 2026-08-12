import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { generateMetadata, SITE_CONFIG } from '../src/lib/metadata'

function findMeta(meta: Array<Record<string, string>>, key: string, value: string) {
  return meta.find((entry) => entry[key] === value)
}

describe('generateMetadata', () => {
  it('uses site defaults when no options are provided', () => {
    const meta = generateMetadata()

    assert.deepStrictEqual(meta[0], { title: SITE_CONFIG.defaultTitle })
    assert.equal(findMeta(meta, 'name', 'description')?.content, SITE_CONFIG.defaultDescription)
    assert.equal(findMeta(meta, 'property', 'og:url')?.content, SITE_CONFIG.siteUrl)
    assert.equal(
      findMeta(meta, 'property', 'og:image')?.content,
      `${SITE_CONFIG.siteUrl}${SITE_CONFIG.defaultImage}`,
    )
  })

  it('formats a custom title across standard, OpenGraph, and Twitter metadata', () => {
    const meta = generateMetadata({ title: 'Vaults' })
    const expected = 'Vaults | Flux - Solana Vault Platform'

    assert.deepStrictEqual(meta[0], { title: expected })
    assert.equal(findMeta(meta, 'property', 'og:title')?.content, expected)
    assert.equal(findMeta(meta, 'name', 'twitter:title')?.content, expected)
  })

  it('joins keyword arrays and preserves keyword strings', () => {
    const arrayMeta = generateMetadata({ keywords: ['SOL', 'vaults'] })
    const stringMeta = generateMetadata({ keywords: 'SOL, DeFi' })

    assert.equal(findMeta(arrayMeta, 'name', 'keywords')?.content, 'SOL, vaults')
    assert.equal(findMeta(stringMeta, 'name', 'keywords')?.content, 'SOL, DeFi')
  })

  it('builds canonical URLs and absolute local image URLs', () => {
    const meta = generateMetadata({ path: '/vaults/alpha', image: '/images/alpha.png' })

    assert.equal(findMeta(meta, 'property', 'og:url')?.content, 'https://flux.io/vaults/alpha')
    assert.equal(findMeta(meta, 'property', 'og:image')?.content, 'https://flux.io/images/alpha.png')
    assert.equal(findMeta(meta, 'name', 'twitter:image')?.content, 'https://flux.io/images/alpha.png')
  })

  it('does not prefix an absolute image URL', () => {
    const meta = generateMetadata({ image: 'https://cdn.example.com/vault.png' })

    assert.equal(findMeta(meta, 'property', 'og:image')?.content, 'https://cdn.example.com/vault.png')
  })

  it('sets no-index robots and custom OpenGraph type', () => {
    const meta = generateMetadata({ noIndex: true, type: 'profile', description: 'Manager profile' })

    assert.equal(findMeta(meta, 'name', 'robots')?.content, 'noindex, nofollow')
    assert.equal(findMeta(meta, 'property', 'og:type')?.content, 'profile')
    assert.equal(findMeta(meta, 'name', 'twitter:description')?.content, 'Manager profile')
  })
})
