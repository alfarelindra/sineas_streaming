---
name: Orval-generated API hook signatures
description: Query hooks take positional id param, not object; mutations take { data } wrapper
---

# API Hook Signatures (Orval-generated)

**Rule:** Query hooks with an `id` param take it positionally, NOT as an object.

**Why:** Orval generates `useGetVideo(id: number, options?)` not `useGetVideo({ id })`.

**How to apply:**
```tsx
// CORRECT
useGetVideo(videoId)
useGetWatchProgress(videoId)
useListComments(videoId)

// WRONG
useGetVideo({ id: videoId })
```

**Mutation hooks** take a `{ data: ... }` wrapper:
```tsx
createVideo.mutate({ data: { title, videoUrl, ... } })
updateMe.mutate({ data: { displayName } })
```

**Hook naming conventions** (from Orval operationId):
- `useGetVideo`, `useListVideos`, `useGetFeaturedVideos`, `useGetTrendingVideos`
- `useGetWatchProgress`, `useUpdateWatchProgress`
- `useListComments`, `useCreateComment`
- `useToggleVideoLike` (not `useLikeVideo`)
- `useGetMe`, `useUpdateMe` (not `useGetCurrentUser`)
- `useListPlans` (not `useGetSubscriptionPlans`)
- `useCreateCheckout`, `useCreatePortal` (not `useCreateCheckoutSession`)
- `useAddToWatchlist`, `useRemoveFromWatchlist`
