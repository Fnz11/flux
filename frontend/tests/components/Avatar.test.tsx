import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getDicebearAvatar, getDicebearUrl } from '@/lib/avatar'

describe('Dicebear Avatar Utility', () => {
  it('generates expected dicebear url with seed', () => {
    expect(getDicebearAvatar('solana-vault')).toBe('https://api.dicebear.com/10.x/loops/svg?seed=solana-vault')
    expect(getDicebearUrl('hello world')).toBe('https://api.dicebear.com/10.x/loops/svg?seed=hello%20world')
  })

  it('uses default seed when empty string is provided', () => {
    expect(getDicebearAvatar('')).toBe('https://api.dicebear.com/10.x/loops/svg?seed=flux')
  })
})

describe('Avatar & AvatarFallback Component', () => {
  it('renders dicebear svg image when seed is provided to fallback', () => {
    render(
      <Avatar>
        <AvatarFallback seed="test-vault">TV</AvatarFallback>
      </Avatar>
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://api.dicebear.com/10.x/loops/svg?seed=test-vault')
  })

  it('renders dicebear svg image when text child is provided to fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>SOL</AvatarFallback>
      </Avatar>
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://api.dicebear.com/10.x/loops/svg?seed=SOL')
  })
})
