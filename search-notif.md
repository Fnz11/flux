# Search and Notification Integration Plan

## 1. Overview
The goal is to integrate functional Search and Notification capabilities into the frontend `NavHeader` and support them via the backend. The integration includes real-time updates via WebSockets for notifications and role-specific search behaviors.

## 2. Notification Feature
### Backend
- **REST API (`/api/v1/notifications`)**: Endpoint to fetch historical or unread notifications for the current authenticated user.
- **WebSocket (`/ws/notifications`)**: A WebSocket handler to push real-time notifications to the client.
- **Storage**: Add a `notifications` table and repository (`internal/repository/notification_repo.go`) to store user notifications (e.g., trade events, vault updates).

### Frontend
- **State Management**: Create `src/stores/notification-store.ts` using Zustand to hold notification history and unread counts.
- **WebSocket Client**: Add `src/services/ws.ts` to manage the WebSocket connection, auto-reconnect, and dispatch events to the store.
- **UI Update**: In `NavHeader.tsx`, replace the "Coming soon" toast on the `Bell` icon with a Popover/Dropdown (e.g., using Radix UI or shadcn/ui components) to list notifications.

## 3. Search Feature
### Role-Based Logic
- **Manager Mode (`isManager: true`)**:
  - The search input will query available token pairs (e.g., SOL/USDC, BTC/USDC).
  - Selecting a pair will immediately navigate the user to `/trade` (or update the active trade pair in the store).
- **Investor Mode (`isManager: false`)**:
  - The search input will query Vaults by name or symbol.
  - Selecting a vault will navigate the user to `/vaults/$id`.

### Implementation Details
- **API**: Add a generic search endpoint `GET /api/v1/search?q=...&role=...` or separate endpoints for pairs and vaults.
- **UI**: Add a command palette or an autocomplete dropdown to the `Search` input in `NavHeader.tsx`. Use a debounce hook (e.g., `useDebounce`) to limit API calls.

## 4. Testing Plan
Following the existing repo's conventions (`node:test` for frontend, Go `testing` with subtests for backend).

### Backend Tests (`backend/internal/...`)
- `notification_api_test.go`: Test fetching notifications (empty, paginated, unread).
- `websocket_test.go`: Test WebSocket upgrade, client connection, and server pushing a message to the correct user.
- `search_test.go`: Test search logic based on different queries and roles.
- **Coverage**: Ensure robust scenarios like missing auth, rate limits, and concurrent WS connections.

### Frontend Tests (`frontend/tests/...`)
- `notification-store.test.ts`: Test store actions (add notification, mark read, clear all).
- `search.test.ts`: Test search utility functions, debounce logic, and routing destinations based on role.
- **Integration**: Test WebSocket reconnection logic using a mocked WebSocket object.

## 5. Execution Steps
1. **Backend Foundation**: Set up notification DB tables, repository, and WebSocket upgrader.
2. **Backend Endpoints**: Build the REST API for notifications and search.
3. **Frontend Store & WS**: Implement the notification store and WS client.
4. **Frontend UI**: Build the Notification popover and Search autocomplete dropdown in `NavHeader.tsx`.
5. **Testing**: Write and verify all tests across FE and BE.
