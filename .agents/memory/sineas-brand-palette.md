---
name: Sineas brand palette
description: Color/brand direction for the Sineas streaming app and how the theme is applied
---

# Sineas brand palette (midnight blue + yellow)

Brand = **royal blue + vivid yellow** on a **midnight-navy** background (from user-supplied logo/gradient assets). Replaced the original dark/crimson Netflix-style theme.

**Role split (keep consistent for any new UI):**
- **Royal blue** = primary interactive color (buttons, active states, links). Buttons keep `text-white` — white on blue-600 passes contrast, so blue was chosen over yellow specifically to avoid white-on-yellow failures.
- **Vivid yellow** (`yellow-400`) = accent for icons, highlights, progress bars, badges, and the logo. **Any solid yellow surface must use dark text** (`text-blue-950`), never `text-white`.
- Background base `#0a0f1e`; CSS tokens in `index.css` (`--primary` blue, `--secondary` yellow).

**Logo:** shared `components/Logo.tsx` — Popcorn icon in a blue box + gradient "SINEAS" wordmark. Use it in Navbar + footers; do not re-inline a raw icon+text logo.

**Why:** matches the attached brand assets and keeps text contrast accessible in dark mode.

## Light/dark theming (critical)
- **The `dark:` Tailwind variant is INERT.** `index.css` defines `@custom-variant dark (&:is(.dark *))` but no `.dark` class is ever added. Dark is the DEFAULT via `:root`; Light Mode is opt-in via `html.light`. So `dark:text-white` never applies, and `text-slate-900 dark:text-white` renders dark text in BOTH modes. **Never use `dark:` here** — use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`) which flip automatically, and add overrides under `html.light` in `index.css` if needed.
- **Legit `text-white` exceptions:** white on solid blue/black/colored surfaces (buttons, badges) and overlay play icons over images are correct in both themes — don't tokenize those.
- **Navbar contrast pattern:** the navbar overlays a dark gradient at top but goes light when scrolled in light mode. Compute `overDark = !scrolled || theme === "dark"` and pick control colors from it (light controls when overDark, dark controls otherwise). `NotificationBell` takes an `overDark` prop for the same reason.

## Known gaps
- **Light mode is now tokenized across all pages** (priority + watch, upload, subscription, profile, dashboard, search, creator, not-found, App.tsx auth wrappers, NotificationBell dropdown). Intentional non-tokenized dark regions remain by design: the watch.tsx video-player block (controls/premium overlay sit over a black `<video>`, so they stay hardcoded dark) and the NotificationBell bell button (theme-aware via `overDark`). Do not "fix" those to tokens.
- `/history` (Riwayat) is a full watch history via `GET /videos/history` (paginated, includes completed items, ordered by last-watched, returns `watchedAt`). Distinct from `GET /videos/continue-watching` which is in-progress only (limit 10) and still powers the home page's "continue watching" row. It supports removing a single item (`DELETE /videos/{id}/watch`) and clearing all (`DELETE /videos/history`). All `/videos/history` routes are registered before `/videos/:id` to avoid the :id param shadowing them.
