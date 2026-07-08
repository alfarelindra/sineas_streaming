/**
 * useGetMyVideos
 *
 * Fetches ONLY the videos uploaded by the currently-authenticated user by
 * calling the protected endpoint GET /api/videos/mine.
 *
 * KEY FIXES vs the previous version:
 *  1. `enabled: isSignedIn` — the query does NOT run until Clerk has confirmed
 *     the user is authenticated.  Previously the query could fire before the
 *     session was ready, getToken() would return null, the request would get a
 *     401, and the dashboard would stay empty.
 *
 *  2. `queryKey` includes `userId` — when the active account changes the cache
 *     key changes too, so the previous user's data is never shown to the new user.
 *
 *  3. `gcTime: 0` — evict the cached result immediately on unmount so a fresh
 *     fetch always happens when the dashboard is reopened, even after a sign-out.
 *
 *  4. Explicit error thrown on non-2xx so React Query marks the query as
 *     errored and retries rather than silently returning undefined.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";

export interface MyVideosResult {
  videos: any[];
  total: number;
  page: number;
  limit: number;
}

export const MY_VIDEOS_QUERY_KEY = "/api/videos/mine";

export function useGetMyVideos(params?: { page?: number; limit?: number }) {
  const { getToken, isSignedIn, userId } = useAuth();

  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set("page", String(params.page));
  if (params?.limit) queryParams.set("limit", String(params.limit));
  const qs = queryParams.toString();
  const url = qs ? `/api/videos/mine?${qs}` : `/api/videos/mine`;

  return useQuery<MyVideosResult>({
    // Include userId in key so a different account gets a fresh fetch, never
    // the previous account's cached result.
    queryKey: [MY_VIDEOS_QUERY_KEY, userId, params],

    queryFn: async ({ signal }) => {
      // getToken() returns the Clerk JWT for the active session.
      // This is the same mechanism used by the generated customFetch hooks
      // (set via setAuthTokenGetter in App.tsx).
      const token = await getToken();

      console.log("[useGetMyVideos] Fetching with userId:", userId, "token present:", !!token);

      const headers: HeadersInit = { Accept: "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      } else {
        // No token means no authenticated session — abort early.
        throw new Error("Sesi autentikasi belum siap. Silakan coba lagi.");
      }

      const res = await fetch(url, { signal, method: "GET", headers });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as any).error ?? `HTTP ${res.status} dari ${url}`;
        console.error("[useGetMyVideos] Error response:", res.status, msg);
        throw new Error(msg);
      }

      const data = (await res.json()) as MyVideosResult;
      console.log("[useGetMyVideos] Berhasil — total video:", data.total, "untuk userId:", userId);
      return data;
    },

    // ── Critical: only run when user is confirmed signed-in ──────────────
    enabled: !!isSignedIn && !!userId,

    // staleTime: 0 — always refetch on mount so switching accounts or
    // returning to the dashboard after upload always shows fresh data.
    staleTime: 0,

    // gcTime: 0 — evict from cache immediately on unmount so the next mount
    // always gets a fresh response (prevents showing a previous user's videos
    // momentarily before the fresh fetch resolves).
    gcTime: 0,

    // Retry once on failure (e.g. token expired and refreshed).
    retry: 1,
  });
}
