# Aceternity AI Agent — Design System

> A premium, dark-first design language for AI agents that balances technical precision with human warmth. Built for trust, clarity, and momentum.

---

## 1. Design Philosophy

### Core Tenets
1. **Dark-First Authority** — The interface lives in `neutral-950` space. Light surfaces are intentional interruptions, not defaults.
2. **Gold as Intelligence** — Warm amber/gold gradients (`#FA9A63` → `#CDA63C`) signal AI cognition, progress, and premium quality.
3. **Motion as Feedback** — Every interaction responds with physical, satisfying motion (400ms ease-out, clip-path reveals, spatial transforms).
4. **Brutalist Elegance** — Sharp geometry, grid systems, and monospace accents mixed with soft blurs and glows.
5. **Zero-Friction Density** — Information-rich layouts that never feel cluttered. White space is structural, not decorative.

### Personality Matrix
| Trait | Expression |
|-------|-----------|
| **Competent** | Precise grids, monospace data, confident typography |
| **Warm** | Gold/orange accents, soft glows, rounded containers |
| **Fast** | Snappy 200ms micro-interactions, 400ms macro-transitions |
| **Premium** | Blur effects, gradient strokes, glassmorphism |

---

## 2. Color Palette

### Primary — AI Intelligence
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-coral` | `#FA9A63` | Primary actions, active states, gradient start |
| `primary-gold` | `#CDA63C` | Secondary highlights, progress indicators |
| `primary-amber` | `#F6B253` | Warm accents, decorative glows |
| `primary-cream` | `#FFD99F` | Soft highlights, background glows |

### Neutral — Structural Foundation
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-void` | `#000000` | Hero backgrounds, immersive modes |
| `bg-surface` | `#0a0a0a` / `neutral-950` | Default agent background |
| `bg-elevated` | `#171717` / `neutral-900` | Cards, panels, elevated surfaces |
| `bg-inset` | `#262626` / `neutral-800` | Input fields, nested containers |
| `border-subtle` | `rgba(255,255,255,0.08)` | Grid lines, dividers |
| `border-medium` | `rgba(255,255,255,0.20)` | Interactive borders, buttons |

### Semantic — Feedback & Status
| Token | Hex | Usage |
|-------|-----|-------|
| `status-success` | `#28C840` | Confirmation, completion |
| `status-warn` | `#FFBD2E` | Caution, attention needed |
| `status-error` | `#FF5F57` | Errors, critical alerts |
| `status-info` | `#3086ff` | Informational states |

### Text — Legibility Hierarchy
| Token | Value | Usage |
|-------|-------|-------|
| `text-primary` | `white` / `#FAFAFA` | Headlines, primary content |
| `text-secondary` | `rgba(255,255,255,0.80)` | Body copy, descriptions |
| `text-tertiary` | `neutral-400` / `#A3A3A3` | Metadata, timestamps |
| `text-muted` | `neutral-500` / `#737373` | Labels, disabled states |
| `text-inverse` | `black` / `#171717` | Text on light surfaces |

### Gradient Patterns
```css
/* Primary Glow */
linear-gradient(to bottom, #FA9A63 0%, transparent 100%)

/* Gold Sweep */
linear-gradient(to right, #FA9A63 0%, #CDA63C 100%)

/* Text Gradient */
linear-gradient(to right, rgba(255,255,255,0.10), transparent)
background-clip: text;
```

---

## 3. Typography

### Font Stack
| Role | Font | Fallback |
|------|------|----------|
| **Display** | Inter | system-ui, sans-serif |
| **Mono** | DM Mono / Geist Mono | ui-monospace, monospace |
| **Body** | Inter | system-ui, sans-serif |

### Type Scale
| Token | Size | Weight | Tracking | Line-Height | Usage |
|-------|------|--------|----------|-------------|-------|
| `display-hero` | 48–72px | 600 | -0.04em | 1.1 | Agent name, primary greeting |
| `display-large` | 32–48px | 600 | -0.03em | 1.15 | Section headers |
| `heading` | 24px | 600 | -0.02em | 1.2 | Card titles, modal headers |
| `subheading` | 18–20px | 500 | -0.01em | 1.3 | Sub-sections, feature names |
| `body-large` | 16px | 400 | 0 | 1.5 | Primary body text |
| `body` | 14px | 400 | 0 | 1.5 | Default content |
| `caption` | 12px | 500 | 0.02em | 1.4 | Labels, badges |
| `micro` | 10px | 500 | 0.04em | 1.2 | Timestamps, technical metadata |
| `data` | 12px | 400 | 0 | 1.4 | Mono-spaced logs, code |

### Typography Rules
- **Negative tracking** on all display sizes (`-tracking-xl`, `-tracking-xs`). Tightening creates density and authority.
- **Mono for data**: Any technical output, status codes, or logs use DM Mono.
- **Balance text**: All headlines use `text-wrap: balance` for even line lengths.
- **Gradient text**: Large display text may use `bg-clip-text` with subtle horizontal fades for depth.

---

## 4. Spacing & Layout

### Container System
| Token | Value | Usage |
|-------|-------|-------|
| `container-max` | 1280px (`max-w-7xl`) | Primary content width |
| `container-wide` | 1152px (`max-w-6xl`) | Logo grids, wide sections |
| `container-narrow` | 768px | Reading width, focused tasks |

### Spacing Scale (Base 4)
| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight internal padding |
| `space-2` | 8px | Icon gaps, tight groups |
| `space-3` | 12px | Button padding, card gaps |
| `space-4` | 16px | Standard padding |
| `space-6` | 24px | Section internal spacing |
| `space-8` | 32px | Component separation |
| `space-10` | 40px | Major section gaps |
| `space-15` | 60px | Hero spacing |
| `space-20` | 80px | Section breaks |

### Layout Patterns
- **Grid**: 19-column conceptual grid (flexible). Common splits: `6/13`, `2/3`, `5/7`.
- **Border Radius Scale**: 
  - `2px` (`rounded-sm`): Tags, micro-elements
  - `5px` (`rounded-[5px]`): Buttons, inputs
  - `8px` (`rounded-lg`): Cards, panels
  - `16px` (`rounded-2xl`): Feature cards, modals
  - `24px` (`rounded-3xl`): Hero containers, immersive frames
  - `9999px` (`rounded-full`): Pills, avatars, status dots
- **Padding Convention**: `px-4 sm:px-6 lg:px-8` for responsive container padding.

---

## 5. Components

### 5.1 Agent Button (Primary CTA)
The signature interaction pattern. A pill-shaped button with a sliding avatar/icon box.

```
Structure:
- Container: relative flex, w-fit, gap-2
- Border: 1px solid rgba(255,255,255,0.20)
- Background: bg-black
- Padding: py-2 pr-4 pl-11 (left padding for icon box)
- Border Radius: rounded-lg (8px)
- Tracking: tracking-tight

Icon Box (left side):
- Size: 32x32px (size-8)
- Background: bg-primary (coral/gold)
- Border Radius: rounded-[5px]
- Position: absolute, inset-y-0, left-1
- Contains: 5x5 dot grid pattern (signature visual)

Hover State:
- Icon box slides to right: left-[calc(100%-2.3rem)]
- Icon box rotates 180deg
- Text shifts left: -translate-x-8
- Background sweep reveals via clip-path: inset(0 0% 0 0)
- Duration: 400ms ease-out
```

### 5.2 Agent Cards
Two variants based on background:

**Dark Card** (`bg-natural-black`)
- Background: near-black with subtle texture
- Border: none (contrast provides separation)
- Padding: `p-4` to `p-6`
- Radius: `rounded-2xl` (16px)
- Decorative: blurred ellipse glows in corners (`blur-3xl`, `fill-white/80`)

**Light Card** (`bg-natural-white`)
- Background: `#FAFAFA` or off-white
- Shadow: `shadow-lg shadow-black/10`, `ring-1 ring-black/5`
- Text: `text-black` primary, `text-neutral-700` secondary
- Radius: `rounded-2xl` (16px)

### 5.3 Status Badges
```
Structure: inline-flex, rounded-full, px-2 py-1
Variants:
- Default: bg-neutral-950, text-natural-white, text-[10px]
- Active: bg-primary-coral, text-white
- Outline: border border-white/20, bg-transparent
```

### 5.4 Notification Stack
Stacked cards representing agent activity:
- Card: `rounded-lg`, `bg-white`, `shadow-black/10`, `ring-black/5`
- Height: fixed `h-20` (80px)
- Stacked with `scale(0.94)`, `scale(0.88)` and negative top offsets
- Meta label: `font-mono text-xs text-neutral-500`
- Content: `text-base text-neutral-700`

### 5.5 Progress Indicators
- **Circular**: SVG-based with `stroke-dasharray` animation, gradient stroke (`#F0F0F0` to `#EDE5CB`), rotating needle.
- **Linear**: `h-1` or `h-2` track, `rounded-full`, gradient fill.
- **Dot Grid**: 5×5 matrix of `size-0.75` dots. Active dots are `bg-white`, inactive are `bg-white/25`.

### 5.6 Input / Chat Field
- Background: `bg-neutral-950` or `bg-[#E6E6E6]` (light mode)
- Border: subtle or `border-white/20`
- Radius: `rounded-lg`
- Focus: ring transition to `primary-coral`

---

## 6. Effects & Motion

### 6.1 Blur & Glow System
| Effect | Value | Usage |
|--------|-------|-------|
| `glow-sm` | `blur-3xl` (64px) | Card ambient light |
| `glow-md` | `blur-[30px]` | SVG stroke halos |
| `glow-lg` | `blur-[50px]` | Background orbs |
| `glow-xl` | `blur-[100px]` | Hero ambient fills |
| `glow-ambient` | `blur-[300px]` | Page-level atmosphere |

### 6.2 Transition Tokens
| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `transition-fast` | 200ms | linear | Color changes, opacity |
| `transition-base` | 300ms | ease-out | Hover states |
| `transition-smooth` | 400ms | ease-out | Layout shifts, clip-paths |
| `transition-dramatic` | 500ms | cubic-bezier(0.4, 0, 0.2, 1) | Page transitions |

### 6.3 Motion Patterns
- **Clip-Path Reveal**: Buttons and cards use `[clip-path:inset(0_100%_0_0)]` → `[clip-path:inset(0_0%_0_0)]` for background sweeps.
- **Spatial Slide**: Elements slide with `translate-x` and `translate-y` rather than fading.
- **Scale Depth**: Background elements use scale transforms (`scale-94`, `scale-88`) to create z-axis depth.
- **Rotate Flip**: The signature button icon rotates 180° on hover.
- **Gradient Flow**: SVG strokes use `linearGradient` with opacity fades to create "energy" movement.

### 6.4 Background Effects
- **Grid Overlay**: SVG rect grid at 70px intervals, `stroke: rgba(255,255,255,0.08)`, with selective `goldGradient` fills.
- **Hex Mesh**: Dense `<circle>` grid (`r="0.22"`, `fill="#404040"`) for technical texture.
- **Star Field**: Scattered circles with randomized opacity (0.2–1.0) for cosmic depth.
- **Orbital Rings**: Large SVG ellipses with gradient strokes and multiple blur layers (`plus-lighter` blend mode).

---

## 7. Iconography

### Style Rules
- **Stroke**: `currentColor`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- **Size Scale**: `size-4` (16px) for inline, `size-6` (24px) for buttons, `size-8` (32px) for features
- **Fill**: Icons are primarily outline (stroke-based). Filled variants use `fill="currentColor"` for solid states.

### Required Icon Categories
1. **Navigation**: Menu, close, arrow directions
2. **Agent Status**: Sparkles, brain, pulse, activity
3. **File Operations**: Photo-scan, document, upload
4. **Communication**: Chat, notification, bell
5. **System**: Settings, search, external-link

---

## 8. Voice & Tone

### Content Principles
- **Direct**: "Replace your Engineering Team" — bold, no hedging.
- **Technical but Accessible**: Use precise terms without jargon overload.
- **Active**: Agent speaks in first-person or imperative. "I'll handle that." / "Deploy now."
- **Confident**: No apologies. "No Calls. No BS. Just Results."

### Microcopy Patterns
| Context | Pattern | Example |
|---------|---------|---------|
| **Loading** | Technical + Progress | "Indexing vectors… 64%" |
| **Success** | Minimal + Confident | "Done." / "Deployed." |
| **Error** | Direct + Solution | "Failed. Retrying with fallback." |
| **Empty** | Action-oriented | "Upload a file to begin analysis." |
| **CTA** | Verb-first imperative | "Chat with Alex" / "View pricing" |

---

## 9. Accessibility

### Contrast Requirements
- All text on dark backgrounds must meet WCAG AA (4.5:1 for body, 3:1 for large text).
- `text-neutral-400` is the minimum for secondary text on `bg-black`.
- Interactive elements must have visible focus rings (`ring-2 ring-primary-coral`).

### Motion Safety
- Respect `prefers-reduced-motion`:
  - Disable clip-path animations
  - Switch 400ms transforms to 0ms or opacity-only
  - Stop continuous SVG rotations

### Semantic Structure
- Headings must follow hierarchy (no skipping `h1` → `h3`).
- Button text must be descriptive (no "Click here").
- Decorative SVGs must have `aria-hidden="true"`.

---

## 10. Implementation Quick Reference

### Tailwind Config Extensions
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'primary-coral': '#FA9A63',
        'primary-gold': '#CDA63C',
        'primary-amber': '#F6B253',
        'natural-white': '#FAFAFA',
        'natural-black': '#0a0a0a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        'xl': '-0.04em',
        'lg': '-0.03em',
        'sm': '-0.02em',
        'xs': '-0.01em',
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'gradient-flow': 'gradientFlow 3s ease infinite',
      }
    }
  }
}
```

### CSS Custom Properties
```css
:root {
  --color-primary: #FA9A63;
  --color-primary-gold: #CDA63C;
  --bg-void: #000000;
  --bg-surface: #0a0a0a;
  --border-subtle: rgba(255,255,255,0.08);
  --border-medium: rgba(255,255,255,0.20);
  --glow-primary: 0 0 80px rgba(250, 154, 99, 0.3);
  --transition-smooth: all 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Appendix: Signature Patterns

### The 5×5 Dot Matrix
Used in buttons, loading states, and agent avatars:
```html
<div class="flex flex-col gap-px">
  <div class="flex gap-px">
    <span class="size-0.75 rounded-full bg-white/25"></span>
    <span class="size-0.75 rounded-full bg-white/25"></span>
    <span class="size-0.75 rounded-full bg-white"></span>
    <span class="size-0.75 rounded-full bg-white/25"></span>
    <span class="size-0.75 rounded-full bg-white/25"></span>
  </div>
  <!-- 4 more rows -->
</div>
```

### The Golden Orb
Background decorative element:
```html
<svg class="absolute -bottom-75 left-1/2 -translate-x-1/2" style="opacity: 0.4; filter: blur(50px); mix-blend-mode: plus-lighter;">
  <ellipse cx="50%" cy="50%" rx="400" ry="200" stroke="url(#goldGradient)" stroke-width="24" />
</svg>
```

### The Sweep Button
```html
<button class="group relative flex w-fit items-center gap-2 rounded-lg border border-white/20 bg-black py-2 pr-4 pl-11">
  <div class="absolute inset-y-0 left-1 my-auto flex size-8 items-center justify-center rounded-[5px] bg-primary transition-all duration-400 ease-out group-hover:left-[calc(100%-2.3rem)] group-hover:rotate-180">
    <!-- Icon -->
  </div>
  <div class="absolute -inset-px rounded-lg bg-white/20 transition-[clip-path] duration-400 [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0_0%_0_0)]"></div>
  <span class="text-white transition-transform duration-400 group-hover:-translate-x-8">Chat with Agent</span>
</button>
```

---

*Document Version: 1.0*  
*Reference: Aceternity UI System*  
*Last Updated: 2026-07-31*
