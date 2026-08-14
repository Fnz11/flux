/**
 * Dicebear Avatar Utilities
 * Generates SVG avatars using the Dicebear 10.x 'loops' style:
 * https://api.dicebear.com/10.x/loops/svg?seed={val}
 */

export function getDicebearAvatar(seed: string): string {
  const cleanSeed = seed ? seed.trim() : 'flux'
  return `https://api.dicebear.com/10.x/loops/svg?seed=${encodeURIComponent(cleanSeed)}`
}

export const getDicebearUrl = getDicebearAvatar
