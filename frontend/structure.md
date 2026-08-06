# Architecture & Code Structure Rules

## Overview

This document defines the core architecture, directory structure, and coding standards for our React, Next.js, and TanStack Start applications. These rules are designed to ensure clean separation of concerns, strict type safety, high maintainability, and seamless consumption by AI coding agents.

---

## 1. Directory Structure

We use a feature-first and colocation-based directory structure. Global assets are segregated by their functional layer (`lib`, `services`, `components`, etc.).

```text
src/ (or app/)
├── app/                  # Framework-level routing & entry points (Next.js App Router / TanStack Start routes)
│   ├── routes/           # (TanStack Start) File-based route tree
│   │   └── projects/
│   │       └── $project-id/
│   │           ├── index.tsx
│   │           ├── _components/   # Page-specific local components (DO NOT import globally)
│   │           ├── _utils/        # Page-specific local helper functions
│   │           ├── _hooks/        # Page-specific local custom hooks
│   │           ├── _constants/    # Page-specific local constants
│   │           └── _stores/       # Page-specific local state stores (Zustand, etc.)
│   └── (nextjs-pages-or-app)/    # Next.js app/pages structure equivalents
│
├── lib/                  # Core application setup, wrappers, and configuration
│   └── api.ts            # Global HTTP client instances (Axios/Fetch setup, interceptors)
│
├── services/             # External data fetching, API integrations, and data layers
│   ├── apis/             # Protocol-specific API implementations
│   │   ├── rest-api/     # RESTful endpoints & services (e.g., project.service.ts)
│   │   ├── graphql/      # GraphQL queries, mutations, and client setup (if applicable)
│   │   └── grpc/         # gRPC or other protocols (if applicable)
│   └── hooks/            # Global custom data-fetching hooks (React Query / TanStack Query)
│       ├── useQuery/     # Reusable query hooks
│       └── useMutation/  # Reusable mutation hooks
│
├── components/           # Global, highly reusable UI components (Buttons, Modals, Layouts)
├── utils/                # Global pure helper functions and formatters
├── constants/            # Global application constants and configuration values
└── types/                # Global TypeScript type definitions and interfaces
```

---

## 2. Colocation vs. Global Scope Rules

### A. Colocated Resources (Prefixed with `_`)

* **Definition:** Folders prefixed with an underscore (`_components`, `_utils`, `_hooks`, `_constants`, `_stores`) placed directly inside a specific route or feature directory.
* **Rule:** Use these **only** when the resource is strictly consumed by that specific page/route.
* **Benefit:** Keeps code modular and allows safe deletion or refactoring of a route without searching through global directories. Routing engines (like TanStack Router or Next.js) automatically ignore folders prefixed with `_` for URL path generation.

### B. Global Resources (`lib/`, `services/`, `components/`)

* **Definition:** Shared modules accessible across multiple features, routes, or pages.
* **Rule:** If a utility, API service, or component is needed in more than one place, it must be hoisted to the corresponding global directory (`lib/`, `services/`, `components/`, etc.).

---

## 3. API & Data Fetching Architecture

### A. Core HTTP Client (`lib/api.ts`)

* The `lib/` directory houses `api.ts`, which configures base HTTP clients (e.g., Axios instance with interceptors for auth tokens, error handling, and base URLs).
* Business logic or endpoints **must not** define raw fetch/axios configurations directly inside components or pages; they must consume clients exported from `lib/`.

### B. API Layer Split (`services/apis/`)

* API wrappers and endpoints are strictly categorized by communication protocol under `services/apis/`:
  * `/services/apis/rest-api/`: Contains RESTful service modules (e.g., `project.service.ts`, `auth.service.ts`). Functions here handle payload formatting and endpoint calls.
  * `/services/apis/graphql/`: Contains GraphQL documents, operations, and clients.
* **Rule:** Never mix raw API query execution directly inside UI presentation components. Always abstract them into service files.

### C. Data Fetching Strategy (TanStack Query Hooks & Store Integration)

* **Data Fetching Layer (`services/hooks/`):**
  * The `/services/hooks/` directory contains global TanStack Query wrappers (`useQuery` and `useMutation`).
  * `useQuery` hooks consume protocol services (`/services/apis/rest-api/`) for caching, refetching, and background updates.
  * `useMutation` hooks handle data mutations and automatically invalidate query keys.
* **Global State Management:**
  * Zustand stores (`useAppStore`, `useVaultStore`, `usePortfolioStore`, etc.) manage local UI state, user mode session, and real-time updates (WebSocket).

### D. Route Protection & Mode-Aware Navigation

* **Manager vs Investor Modes:**
  * Application supports dual operating modes: `Manager` and `Invest`.
  * Manager-only routes (e.g. `/trade`) are protected using route guards (`beforeLoad` in TanStack Router) and reactive component redirects.
  * If an investor user attempts to navigate to `/trade`, they are automatically redirected to `/invest`.

---

## 4. Coding Standards for AI Agents

1. **Strict Type Safety:** Always define explicit TypeScript interfaces/types for API request payloads, responses, and component props. Avoid `any`.
2. **Import Boundaries:** Never import a local component from a route's `_components` folder into another route or global file. Global files can be imported anywhere, but local files cannot cross-import outside their feature boundary.
3. **File Naming:** Use kebab-case for file names (e.g., `project-details.service.ts`) and PascalCase for React component files (e.g., `ProjectCard.tsx`).
4. **Separation of Concerns:** Keep UI rendering separate from data fetching logic. Pages/Components should render data; Services fetch data; `lib/` configures clients.
5. **Modularity micro components:** Let say want to make a table, then create TableHeader.tsx, TableBody.tsx, Table.tsx, TableRow.tsx
6. **Separate logic and UI:** STRICTLY AVOID doing logic on the UI `return ()`, if logic is small, we can put it in the component but before `return ()`, if the logic so many and complex, separate into hook in new file
