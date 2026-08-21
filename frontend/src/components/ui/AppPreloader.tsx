import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function AppPreloader() {
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    // Smooth minimum display time so user sees cohesive branded entry
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, 450)

    // Remove from DOM after fade out transition completes (700ms)
    const removeTimer = setTimeout(() => {
      setIsDone(true)
    }, 1150)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (isDone) return null

  return (
    <div
      aria-hidden="true"
      className={cn(
        'fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-700 ease-out',
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      )}
      style={{
        background: 'radial-gradient(ellipse at center, #211A1C 0%, #131111 50%, #131111 100%)',
      }}
    >
      {/* Vignette dark rim overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 120px 40px rgba(0, 0, 0, 0.85)',
        }}
      />

      {/* Ambient Pulsing Glow behind logo */}
      <div className="absolute size-96 rounded-full bg-gradient-to-tr from-primary-coral/5 via-primary-gold/3 to-primary-amber/2 blur-3xl animate-pulse pointer-events-none" />

      {/* Pure Logo with Pulse */}
      <div className="relative z-10 flex items-center justify-center">
        {/* Subtle logo pulse bloom */}
        <div className="absolute -inset-6 rounded-full bg-primary-coral/10 blur-2xl animate-ping" />
        
        <img
          src="/logo.png"
          alt="Flux"
          className="relative size-28 sm:size-40 md:size-56 object-contain drop-shadow-[0_0_35px_rgba(255,107,53,0.5)] opacity-60"
        />
      </div>
    </div>
  )
}
