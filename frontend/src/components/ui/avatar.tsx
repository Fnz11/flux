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
  ({ className, src, alt, onError, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false)
    if (!src || hasError) return null
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        onError={(e) => {
          setHasError(true)
          onError?.(e)
        }}
        className={cn('aspect-square h-full w-full object-cover rounded-[inherit]', className)}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = 'AvatarImage'

export interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  seed?: string
  src?: string
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, seed, src, children, ...props }, ref) => {
    const [imgError, setImgError] = React.useState(false)
    const seedVal = seed || (typeof children === 'string' && children.trim().length > 0 ? children.trim() : '')
    const dicebearUrl = seedVal ? getDicebearAvatar(seedVal) : ''
    const effectiveSrc = src && !imgError ? src : dicebearUrl

    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-[inherit] bg-bg-inset text-text-secondary overflow-hidden',
          className
        )}
        {...props}
      >
        {effectiveSrc ? (
          <img
            src={effectiveSrc}
            alt={typeof children === 'string' ? children : seedVal || 'Avatar'}
            onError={() => {
              if (src && !imgError) {
                setImgError(true)
              }
            }}
            className={cn(
              'h-full w-full object-cover rounded-[inherit]',
              effectiveSrc === dicebearUrl && 'scale-[1.42]'
            )}
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
