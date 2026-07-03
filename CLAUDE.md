# CLAUDE.md — working rules for this repo

This file orients any AI agent (or human) editing **Slackify for Google Chat**. Read it
before changing code. Full detail lives in [`docs/EXTENSION-BEST-PRACTICES.md`](docs/EXTENSION-BEST-PRACTICES.md).

## What this is

A Manifest V3 Chrome extension that **cosmetically** restyles Google Chat
(`chat.google.com`) to feel like Slack. It injects CSS and tags DOM nodes; it never
changes Chat's behavior, and **no data ever leaves the browser**.

One deliberate, narrow exception: the **`shortcuts` feature (default OFF)** adds Slack-style
keyboard shortcuts (`src/shortcuts.js`). It only ever `focus()`es/`click()`s elements Chat
already renders, checks its feature attribute per keystroke, and never consumes a key when its
target is missing (fail-safe). Do not grow it into behavior that mutates or reorders Chat's UI,
and **never bind a combo Chat already has** (check Shift+? first — Cmd/Ctrl+Shift+K was removed
for exactly this: Chat binds it natively for "New chat").

## The 10 rules (non-negotiable)

1. **Never target hashed/auto-generated classes** (`.EAOoq`, `.pGxpHc`). Google recomputes
   them every build. Target only `role`, `aria-label`, semantic `data-*`, `:has()`, or our
   own `data-slackify="…"` tags.
2. **All selectors live in `src/config.js`** as `[primary, ...fallbacks]` arrays — one place.
   Every chain should end with a **locale-independent** fallback (aria-label text is localized).
3. **Generate CSS from config** (`src/styles.js`); don't hand-write selector strings in a
   static stylesheet (a fallback list needs its scope prefix distributed across each selector).
4. **No new permissions** without strong cause. Current: `storage` only. Never add `tabs`,
   `scripting`, host permissions, `webRequest`, `cookies`.
5. **No network, ever.** No `fetch`/`XHR`/`WebSocket`/beacons. No remote code (`eval`,
   `new Function`, remote `<script>`). This keeps us provably unable to exfiltrate.
6. **The host app must never break.** Wrap every DOM derivation in `try/catch`; prefer CSS
   over JS; the MutationObserver must be cheap (act on `addedNodes`, debounce with rAF).
7. **Features are attribute-gated.** Each lives behind `html[data-sf-feat-<id>]` and is listed
   in `config.js` `FEATURES`. Adding a feature = add to `FEATURES`, add gated rule(s) in
   `styles.js`, expose in the popup (automatic from `FEATURES`).
8. **Themes are data.** Add to `src/themes.js` using verified hex (see `docs/SLACK-THEMES.md`).
   Theme = sidebar/top-bar vars; light/dark MODE = message-area vars. Don't guess hex.
   **The light/dark mode selection must match the user's Google Chat appearance setting** (Settings
   → Theme → Light/Dark/Device default). The popup's mode toggle must stay in sync with GChat's own
   mode; CSS variables like `--sf-search-drop-bg`, `--sf-code-bg`, `--sf-msg-hover` are defined per
   mode in `MODES` (themes.js) so they automatically adapt. When adding mode-dependent styling,
   always add the value to both `MODES.light` and `MODES.dark` and reference it via a CSS variable —
   never hard-code `#FFFFFF` or `#1D1C1D` directly in a rule that should flip with the mode.
9. **Keep `tools/health-check.js` in sync** with `config.js`. It's the breakage radar.
10. **Verify visually** before claiming done (Chrome DevTools MCP screenshots; see
    `tools/SMOKE-TEST.md`). Bump `manifest.json` version on user-facing change.

## Performance & lightweight doctrine (non-negotiable)

This is a **skin**. It must add **no perceptible CPU or memory overhead** — Google Chat must
feel exactly as fast with it on. The architecture enforces this; do not regress it:

- **Idle-time only.** All tagging runs in `requestIdleCallback`, never inline. The
  `MutationObserver` callback **only collects** added nodes into a Set and schedules — it must
  never call `getComputedStyle`, `querySelectorAll`, or any layout/style read.
- **Throttle.** At most one pass per idle slot (`if (scheduled) return`). Never one pass per mutation.
- **Cache / precompute — one-time work must never repeat per cycle.** Every expensive
  derivation is cached: `processedTopics` (scan each message once, ever), `lightScanned` (rail
  button scan once per rail), `datedNodes`, and early-returns for rail / stream / active. An
  idle pass with nothing new must do **zero** `getComputedStyle` calls (this is tested).
- **No forced reflow in hot paths.** `getComputedStyle`/`getBoundingClientRect` force style/layout.
  Use them only where unavoidable and only **once per element** (cached). Never on every
  re-render, never over the whole rail every frame.
- **No `:has()` in generated CSS.** `:has()` is re-evaluated on every style recalc over Chat's
  huge, mutating DOM (jank) and a broad `:has()` over-matches (paints the message area →
  flicker). Resolve containers in JS and tag them (`data-slackify="rail"` etc.); CSS targets the tag.
- **Lazy / visible-only.** Scan only what the user can see: message topics are gated behind an
  `IntersectionObserver` (`rootMargin` ≈ one viewport). Off-screen history Wiz bulk-loads on
  back-scroll is never scanned until viewed.
- **O(1) observer callback.** The `MutationObserver` only sets a `dirty` flag and schedules — no
  per-node work, no `querySelector`, no style/layout reads inline. Observe the narrowest useful tree.
- **Dirty-flag passes.** Region work (rail/active/stream/light/dates) runs only when the tree
  changed; a "cached early-return" still costs a `querySelector` if called every pass.
- **Split reads from writes.** In any scan, collect all `getComputedStyle` decisions into arrays
  first, then apply all `setAttribute` writes — never interleave (a write dirties style and forces
  the next read to recalc).
- **Scope every query** to the smallest known root (rail/pane), never `document`; prefer specific
  candidate selectors over `*`.
- **Hands off host rendering.** Never apply `content-visibility` / `contain` / `will-change` to
  Google-owned nodes — it fights Wiz's own rendering. Never disconnect an observer without a
  re-attach plan; keep node caches Weak-keyed so they can't leak.

Full analysis + citations: [`docs/PERFORMANCE-REVIEW.md`](docs/PERFORMANCE-REVIEW.md).

**This contract is enforced by [`test/performance.test.js`](test/performance.test.js). Keep it green.**
Run `npm test` before every change that touches `tagger.js`, `styles.js`, or `config.js`.

## File map

| File | Role |
| --- | --- |
| `src/config.js` | selectors (+fallbacks), feature list, defaults, helpers — the source of truth |
| `src/themes.js` | Slack theme palettes + light/dark mode values |
| `src/styles.js` | compiles the stylesheet from config + themes (feature-gated) |
| `src/apply.js` | injects the sheet; reflects prefs onto `<html data-sf-*>`; listens to storage |
| `src/tagger.js` | MutationObserver that stamps `data-slackify` tags on hook-less elements |
| `src/controls.js` | injects the in-page "Hide meetings" switch into Chat's Home filter row; writes prefs to `chrome.storage.sync` (same path as the popup) |
| `src/shortcuts.js` | opt-in Slack keyboard shortcut (⌘/Ctrl+K → search) — additive only, fail-safe, never a combo Chat binds |
| `popup/` | settings UI (toggles, theme, light/dark) → `chrome.storage.sync` |
| `tools/health-check.js` | paste-in selector health check |
| `docs/` | best practices + Slack theme reference |

## How preferences flow

`popup/popup.js` writes `{prefs}` to `chrome.storage.sync` → `apply.js`'s
`storage.onChanged` listener flips `data-sf-*` attributes on `<html>` → the already-injected
stylesheet reacts. No rebuild, no reload.

## Local testing

Load unpacked at `chrome://extensions` (Developer mode → Load unpacked → this folder), open
`chat.google.com`. For quick iteration without reloading the extension, the source files can
be concatenated and run in the DevTools console (the `chrome.storage` calls fall back to
defaults via try/catch).
