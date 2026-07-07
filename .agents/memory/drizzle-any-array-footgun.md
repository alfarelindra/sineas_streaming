---
name: Drizzle ANY(array) footgun in api-server
description: Interpolating a JS array into a drizzle sql template produces invalid Postgres, not a bound array
---

Interpolating a JS array directly into a drizzle `sql` template — e.g.
`sql\`${videosTable.id} = ANY(${videoIds})\`` — does NOT bind a Postgres array.
Drizzle flattens the array into comma-separated placeholders, producing
`ANY(($1, $2, ...))` (a ROW/record), and Postgres rejects it with
`op ANY/ALL (array) requires array on right side`. The query only appears to
work when the array is empty (guarded by `if (ids.length)`), so it fails
exactly when there is real data.

**Why:** This silently breaks any list endpoint that fetches videos by a set of
ids as soon as the user has ≥1 matching row (watch history, continue-watching).

**How to apply:** Use `inArray(column, arr)` from `drizzle-orm` for id-set
lookups, not raw `ANY(${arr})`. In `artifacts/api-server/src/routes/videos.ts`
the history endpoint was fixed to use `inArray`; the continue-watching endpoint
(`GET /videos/continue-watching`) still had the same raw-`ANY` pattern at time
of writing — check it before trusting that row.
