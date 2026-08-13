import { cn } from '@/lib/utils'

export const DotMatrix = () => (
  <div className="flex flex-col gap-[2px]">
    {[0, 1, 2, 3, 4].map((row) => (
      <div key={row} className="flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((col) => {
          const isActive = (row + col) % 2 === 0 || row === 2 || col === 2
          return (
            <span
              key={col}
              className={cn(
                'h-[3px] w-[3px] rounded-full transition-colors duration-400',
                isActive ? 'bg-black' : 'bg-black/30',
              )}
            />
          )
        })}
      </div>
    ))}
  </div>
)
