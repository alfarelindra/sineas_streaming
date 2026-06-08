---
name: Clerk v6 React compatibility
description: SignedIn/SignedOut components not exported from @clerk/react v6 — use useAuth() instead
---

# Clerk v6 React Compatibility

**Rule:** `<SignedIn>` and `<SignedOut>` are not exported from `@clerk/react` v6. Using them causes TS2724 errors.

**Why:** Clerk v6 changed their exports. The component helpers were removed or renamed.

**How to apply:** Create local wrappers using `useAuth()`:

```tsx
function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <>{children}</> : null;
}
function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return !isSignedIn ? <>{children}</> : null;
}
```

Or just use conditional rendering directly:
```tsx
const { isSignedIn } = useAuth();
{isSignedIn && <ProtectedContent />}
```
