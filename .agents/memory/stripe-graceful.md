---
name: Stripe graceful fallback
description: Stripe is optional — subscription routes use static IDR plans when not connected
---

# Stripe Graceful Fallback

**Rule:** Never block any feature or re-propose Stripe setup unless the user explicitly asks.

**Why:** User dismissed the Stripe OAuth flow. Subscription routes are designed to work without Stripe using static IDR plan definitions.

**How to apply:**
- `GET /api/subscription/plans` returns static plans (Basic Rp19k, Premium Rp65k, Ultra Rp120k) when Stripe is not connected
- `POST /api/subscription/checkout` returns a 503 with a friendly Indonesian error message when Stripe is not available
- All Stripe calls are wrapped in try/catch with graceful fallback
- The 401 errors on `/subscription/status` and `/users/me` from unauthenticated users are expected and normal — not Stripe issues
