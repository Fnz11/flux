Frontend Audit — FBYT POC
Read as: dark DeFi vault product UI, Aceternity-style gold-on-void language. Tokens mostly land. Product shell half-wired. Portfolio-grade polish not there yet.
Scorecard
Area	Grade	Note
Design tokens vs design.md	B+	Colors/type/surfaces match
Signature UI patterns	D	Sweep button, glows, motion missing
Architecture / structure	B	Colocation good; layers leak
Clean / readable	B-	Small files, some stubs/dupes
Scalable	C+	Zustand OK; no query layer, dual HTTP
Secure	C	No secrets leaked; wallet/IDL unsafe stubs
Works end-to-end	D	UI shells yes; chain/API mostly fake
A11y / mobile	C-	Focus rings OK; no mobile nav
Tests	F	Zero app tests
1. Design.md match
Hits
- styles.css @theme mirrors design tokens: coral/gold/amber, void/surface/elevated, status, text hierarchy, Inter + DM Mono, tracking scale.
- Dark-first root: bg-bg-void, elevated cards rounded-xl border-border-subtle.
- Buttons use coral + focus-visible:ring-primary-coral.
- Page headers: text-balance, tight tracking, secondary body text.
- Status badges ≈ design 5.3.
Misses (big for portfolio demo)
design.md	Reality
Signature sweep Agent Button (clip-path, icon slide, 5×5 dots)	Plain shadcn Button
Motion 200/400ms, clip-path reveals	Almost static
Glow orbs, grid overlay, hex mesh	None
Gold sweep gradients on CTAs	Rare / logo only
duration-400 layout shifts	Not used as system
responsive.css reduced-motion	File exists, never imported in styles.css
Fonts	Google Fonts @import (blocking, privacy) — self-host or fontsource better
Verdict: Token layer solid. Personality layer absent. Recruiter sees clean dark SaaS, not Aceternity-grade agent UI.
2. Architecture
Good
routes/…/_components  _hooks   ← colocation per structure.md
components/ui/*                ← shared primitives
stores/*                       ← domain slices
services/apis/rest-api/*       ← service boundary
types/*                        ← Api* + domain types
- TanStack Start + file routes clean.
- Create vault: RHF + Zod, logic in hook.
- Swap form split: TokenSelector / PriceDisplay / ConfirmationDialog.
- Charts split outer/inner (good for later lazy load).
Structural problems
1. Dual HTTP clients — critical
// lib/api.ts — BOTH fetch wrapper `api` AND axios `client`
// vault/portfolio/config → api (fetch)
// fee/trade → client (axios)
Two paths, two error shapes, double auth wiring. Pick one.
2. No snake→camel mappers
Types define ApiVault (manager_id) and Vault (managerId), but services return raw JSON as Vault. Backend snake_case → UI fields undefined at runtime.
3. structure.md vs code
Docs promise SSR-first + React Query hooks. Code = client useEffect + Zustand fetch. Docs lie → agents (and you) will fight the codebase.
4. Wallet stack incomplete
- @solana/wallet-adapter-react used in pages.
- No ConnectionProvider / WalletProvider in __root.tsx.
- No WalletConnectButton.
- Nav shows static "U" avatar.
5. On-chain hooks are stubs
- useExecuteTrade: vault/mints/pyth all set to wallet.publicKey — wrong, dangerous if ever signed.
- useDeposit: new Program({} as Idl, …) empty IDL.
- idl.json: placeholder program id + incomplete accounts.
- getProgram duplicated (lib/anchor.ts + hook).
6. Stores not bootstrapped
- config-store / websocket-store never connected from root.
- Mode toggle no route guard → investor can sit on /trade.
- authToken in api.ts — no setAuthToken export, never set.
7. Orphan / dead
- styles/responsive.css unused.
- selectedVaultId in payout always ''; dead .find().
- Home stats hardcoded $0.
- Portfolio TradeHistory trades={[]}.
- Settings = placeholder.
- Plan items missing: ErrorBoundary, toasts, VirtualizedList, quote-lock on wallet prompt.
3. Clean code / readability
Good	Bad
Small components	Naming mix: nav-bar.tsx vs StatusBadge.tsx vs stat-card.tsx
Typed domain models	any on chart tooltips, wallet signers
Guard-ish early returns in hooks	Swap Max button broken (setInputAmount('' or '0'))
formatError helper	cn() = clsx only — no tailwind-merge
 	Fee N+1: Promise.all(vaults.map(getAccruedFees))
 	Pyth IDs for USDC/SOL, BONK/SOL look fake/wrong
4. Security
Item	Status
Secrets in repo	OK (env for API base)
Token storage	Memory only — good; never wired
XSS	No dangerouslySetInnerHTML seen
Wallet TX construction	High risk stubs — wrong accounts if user signs
API auth	Bearer ready, no login flow
External fonts	Third-party request on every load
WS	No auth on subscribe messages
For portfolio POC: disable real sign until accounts/IDL real, or hard-gate behind “demo mode”.
5. Does it work?
Surface	Likely state
Static pages / layout	Renders
Nav mode switch	Works (sessionStorage)
Lists/forms UI	Renders empty/error if API down
Wallet connect	Broken (no provider)
Deposit / trade / create on-chain	Will fail
Live PnL via WS	Store exists, not mounted
Pyth prices	Partial (SOL/USDC maybe; other pairs bad IDs)
Mobile nav	Broken — links hidden md:flex, no menu
6. What to fix first (portfolio priority)
P0 — Demo must not lie
1. Wire WalletProvider + custom connect button (design tokens).
2. Single HTTP client + mappers Api→domain.
3. Root bootstrap: fetchConfig, optional WS connect.
4. Import responsive.css or merge reduced-motion into styles.css.
5. Mobile hamburger nav.
6. Kill/guard broken Max + stub sign paths (demo banner if mock).
P1 — Design.md personality
 7. Implement signature sweep button as primary CTA.
 8. One hero ambient (gold orb / grid) on dashboard or trade.
 9. Motion: 400ms hovers, respect reduced-motion globally.
10. Self-host Inter + DM Mono (drop Google CSS import).
P2 — Architecture honesty
11. Add TanStack Query or delete that promise from structure.md.
12. Error boundary + toast on tx fail (Solscan link).
13. Mode-aware redirects (/trade manager-only).
14. One getProgram module; real IDL when program ready.
15. tailwind-merge in cn.
16. Lint + typecheck scripts; smoke tests on mappers + stores.
P3 — Polish
17. Wire home/portfolio to real aggregates.
18. Virtualize vault list if >50.
19. Dynamic import recharts.
20. Replace lucide only if you care about design-taste skill; not blocking.
7. Bottom line
Structure: good POC bones. Feature colocation, tokenized dark UI, Zustand slices, typed API shapes — shows you know product frontend.
Not portfolio-ready yet because:
1. Design system tokens without signature motion/components → generic dark app.
2. Wallet/chain/API half-stubbed → clicks die or worse, bad signatures.
3. Dual client + no mappers → silent data bugs.
4. Mobile nav + empty dashboard/settings → unfinished feel in 10s review.
Ship story for recruiters: “Dark-first vault platform, token-driven UI, colocated routes, real-time store design.”  
Don’t claim: “Production Solana trading UI” until provider + IDL + mappers real.