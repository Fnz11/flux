'use client'

import { Provider, Root, Trigger, Content, Arrow } from '@radix-ui/react-tooltip'

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider delayDuration={200} skipDelayDuration={100}>
      {children}
    </Provider>
  )
}

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

export function Tooltip({ children, content, side = 'top', align = 'center' }: TooltipProps) {
  return (
    <Provider delayDuration={200} skipDelayDuration={100}>
      <Root>
        <Trigger asChild>{children}</Trigger>
        <Content
          side={side}
          align={align}
          sideOffset={4}
          className="z-[100] max-w-xs rounded-xl border border-border-subtle bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary shadow-lg"
        >
          {content}
          <Arrow className="fill-bg-elevated" />
        </Content>
      </Root>
    </Provider>
  )
}
