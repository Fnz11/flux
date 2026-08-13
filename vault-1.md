# Vaults Page Improvements Plan

## 1. Implement Search
- Update the `/vaults` route to accept a `search` query parameter in the `vaultsSearchSchema` if not already present.
- Pass the search query to the `GET /api/v1/vaults` API request.
- Add a Search input component in the UI that debounces user input and updates the URL search params.

## 2. Implement Infinity Scroll
- Change the data fetching hook to use `useInfiniteQuery` (or equivalent data fetching strategy) to support pagination/cursors.
- Update the backend API `GET /api/v1/vaults` to support `limit` and `cursor`/`offset`.
- Implement an Intersection Observer (e.g., via `react-intersection-observer`) at the bottom of the list to trigger loading the next page.

## 3. Implement Virtualization
- Wrap the vault list with a virtualization library like `@tanstack/react-virtual` to only render the visible DOM nodes.
- Combine this with the infinite scroll to maintain high performance regardless of how many vaults are loaded in memory.

## 4. Fix WebSocket Unauthorized Error
- **Error Context:** `unauthorized subscription channel` for `user:<pubkey>`
- **Plan:**
  - Verify that the auth token (JWT or session) is correctly sent when establishing the WebSocket connection or sending the `subscribe` message.
  - On the backend, verify the authentication middleware for the WebSocket handler. Ensure it correctly maps the authenticated session to the requested `user:<pubkey>` channel.
  - If the pubkey does not match the authenticated user, or if auth is missing, provide a clear authentication flow before attempting to subscribe.

## 5. Optimize Sparkline Data Fetching
- **Current Issue:** N+1 network requests (fetching `GET /api/v1/vaults` and then fetching sparklines individually).
- **Plan:**
  - Since sparkline data is pre-computable and should be stored in a materialized view, update the backend `GET /api/v1/vaults` query to include the sparkline array directly in the vault response payload.
  - Modify the frontend types to expect `sparkline` data on the vault object.
  - Remove the individual sparkline API calls and hooks from the vault row components.
