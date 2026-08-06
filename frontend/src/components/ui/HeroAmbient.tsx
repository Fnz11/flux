import * as React from 'react'
import { cn } from '@/lib/utils'

export interface HeroAmbientProps {
  variant?: 'gold' | 'amber' | 'full'
  className?: string
}

export const HeroAmbient: React.FC<HeroAmbientProps> = ({ variant = 'full', className }) => {
  return (
    <div
      className={cn(
        'pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-screen max-w-7xl h-[560px] overflow-hidden select-none -z-10',
        className,
      )}
      aria-hidden="true"
    >
      {/* Stakent Dotted Background Mesh */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22] [mask-image:radial-gradient(ellipse_at_top,black_50%,transparent_90%)]"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="hero-dots-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="rgba(255, 255, 255, 0.25)" />
          </pattern>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FA9A63" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#F6B253" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#CDA63C" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots-pattern)" />
      </svg>

      {/* Primary Coral & Gold Glow Ambient */}
      <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 h-[340px] w-[800px] sm:w-[1000px] rounded-full bg-gradient-to-b from-primary-coral/20 via-primary-amber/12 to-transparent blur-[140px] opacity-70" />

      {/* Secondary Stakent Deep Blue Accent Glow */}
      <div className="absolute top-10 right-[10%] h-[280px] w-[500px] rounded-full bg-indigo-600/10 blur-[130px]" />

      {/* Soft Golden Ring Arc */}
      {variant !== 'amber' && (
        <svg
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-[960px] h-[360px] opacity-30 mix-blend-screen blur-[45px]"
          viewBox="0 0 960 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse
            cx="480"
            cy="150"
            rx="420"
            ry="140"
            stroke="url(#goldGradient)"
            strokeWidth="16"
          />
        </svg>
      )}
    </div>
  )
}
