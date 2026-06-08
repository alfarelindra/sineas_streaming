# Sineas

Platform streaming video Indonesia premium (Netflix-style + upload seperti YouTube).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/sineas run dev` — run the Sineas frontend (port 21628)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Clerk auth middleware
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter routing
- Auth: Clerk (whitelabel)
- Storage: Replit Object Storage

## Where things live

- `lib/db/src/schema/` — DB schema (users, videos, genres, watchlist, watch_progress, likes, comments)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated React Query hooks + Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/` — Clerk auth middleware
- `artifacts/sineas/src/pages/` — frontend pages (home, browse, watch, upload, subscription, profile)
- `artifacts/sineas/src/components/` — shared components (Navbar, VideoCard, HeroSection, VideoRow)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks
- Stripe integration is optional/graceful: subscription plans use static IDR definitions when Stripe not connected. Never re-propose Stripe setup unprompted.
- Clerk auth is proxied through the Express server via `clerkProxyMiddleware`
- Object storage for video/thumbnail uploads via Replit Object Storage
- Frontend uses `useAuth()` hooks instead of `<SignedIn>/<SignedOut>` components (Clerk v6 compatibility)

## Product

- **Beranda**: Hero section with featured/trending video rows by genre
- **Jelajahi**: Browse/search with genre filter, pagination
- **Tonton**: Video player with progress tracking, likes, comments, related videos
- **Upload**: Video upload with file or direct URL, thumbnail, genre, premium gating
- **Berlangganan**: 3 tiers — Basic Rp19rb, Premium Rp65rb, Ultra Rp120rb/month
- **Profil**: Watchlist, subscription status, profile edit

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Clerk v6: `SignedIn`/`SignedOut` components not exported from `@clerk/react` — use `useAuth()` conditional rendering instead
- API hooks take plain `id: number` not `{ id: number }` objects (e.g. `useGetVideo(videoId)` not `useGetVideo({ id: videoId })`)
- Do NOT run `pnpm dev` at workspace root — use `restart_workflow` instead
- Stripe is graceful fallback only — do not block any feature on Stripe connectivity

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
