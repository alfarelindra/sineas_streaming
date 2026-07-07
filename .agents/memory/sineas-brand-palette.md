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

## Known gaps (not brand-specific)
- **Light mode is not fully theme-tokenized.** Many pages hardcode `bg-[#0a0f1e] text-white`; `index.css` only overrides the *background* for `.min-h-screen.bg-[#0a0f1e]` in `html.light`, so `text-white` children can be unreadable on the near-white light bg. Fixing properly means moving pages to `bg-background`/`text-foreground` tokens. Pre-existing, not caused by the rebrand.
- No `/history` page/route exists yet (App.tsx) despite being referenced in product discussions.
