import * as React from 'react'
import { cn } from '@/lib/utils'
import { getDicebearAvatar } from '@/lib/avatar'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bg-inset border border-border-subtle',
        className
      )}
      {...props}
    />
  )
)
Avatar.displayName = 'Avatar'

export interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, ...props }, ref) => {
    if (!src) return null
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        className={cn('aspect-square h-full w-full object-cover', className)}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = 'AvatarImage'

export interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  seed?: string
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, seed, children, ...props }, ref) => {
    const seedVal = seed || (typeof children === 'string' && children.trim().length > 0 ? children.trim() : '')
    const dicebearUrl = seedVal ? getDicebearAvatar(seedVal) : ''

    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full bg-bg-inset text-text-secondary overflow-hidden',
          className
        )}
        {...props}
      >
        {dicebearUrl ? (
          <img
            src={dicebearUrl}
            alt={typeof children === 'string' ? children : seedVal || 'Avatar'}
            className="h-full w-full object-cover"
          />
        ) : (
          children
        )}
      </div>
    )
  }
)
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback, getDicebearAvatar }
