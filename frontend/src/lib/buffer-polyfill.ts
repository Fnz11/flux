import { Buffer } from 'buffer'

declare global {
  interface Window {
    Buffer?: typeof Buffer
  }
}

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer
}

if (typeof globalThis !== 'undefined') {
  ;(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer =
    (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer || Buffer
}
