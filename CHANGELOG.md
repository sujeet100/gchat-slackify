# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.2] — 2026-07-03

### Removed
- The Ochin theme (added in 1.4.0): its pale window frame never looked right on Google Chat's tall
  banner. Anyone who had selected it falls back to the default theme automatically.

### Fixed
- The compose box could collapse to icon-width and grow as you type on some of Google's A/B Chat
  shell variants (seen on Chrome 149 with the "Apps" bottom bar): if the composer's centering
  wrapper is a COLUMN flexbox, `flex: 1 1 auto` is inert on the cross axis and `width: auto`
  shrinks to content. The composer now also stretches (`align-items`/`align-self: stretch`), which
  fills the width in both wrapper orientations.

## [1.4.1] — 2026-07-03

### Fixed
- Ochin's top bar deepened to a clearly-blue periwinkle (`#D9E3F4` → `#C9D8F0`): the raw Slack
  sample is a thin frame strip, but on GChat's tall 64px banner it read washed-out/unthemed.

## [1.4.0] — 2026-07-03

### Added
- **Ochin theme** (Slack's slate-blue classic), sampled from a live Slack ochin-light client: pale
  blue sidebar, slate-navy active row, and a PALE window frame with dark ink.

### Changed
- **All themes recalibrated against live Slack references** (aubergine/jade/ochin screenshots):
  the shared principles are pale brand-tinted sidebar, ink-blended sidebar text, vivid brand
  active row, brand-tinted hover wash — plus a per-theme window-frame color (Slack sets frames
  individually: aubergine dark plum, jade mid-green `#4A9679`, ochin pale blue). The Chat-logo
  dark-lockup swap is now emitted per theme×mode based on frame luminance, so pale frames
  (ochin light, pale custom themes) keep the readable native logo.
- **Conversation title sized like Slack**: 18px Lato Black (GChat's ~22px title read much bigger
  than Slack's header).
- **Reaction chips keep GChat's native shape** (deliberate): tag-based reshaping has a re-render
  window where a fresh chip briefly shows native styling next to restyled ones — that flash of
  inconsistency is worse than not reshaping. The self-message alignment fixes stay, "Add reaction"
  still moves after the chips, and chips now re-tag reliably after Wiz re-renders.

### Fixed
- **Thread links use one blue**: the "N unread" link kept Google's blue while "N replies" got
  Slack's — both are now tagged and share the same link color.
- **Thread elbow connector hidden**: Slack's thread affordance has no curved connector line; GChat's
  is detected by shape (empty, small, bordered rounded corner) and hidden — fail-safe if the
  structure changes.

## [1.3.0] — 2026-07-03

### Added
- **Slack-style unread line** (default ON): the new-messages divider is now a straight red line
  with the label at the right (Slack style) instead of GChat's wavy blue line with a centered chip.

### Fixed
- **Date dividers actually get their line now.** Two bugs: the once-per-conversation date scan
  missed dividers inside lazily-loaded history, and it tagged the pill's 90px parent as the "wrap",
  so the divider line never spanned the stream. Dividers are now found via durable hooks — the
  `[role="heading"]` row and its `data-format="3"` timestamp span — on every pass (cached per
  element).
- **"Add reaction" made consistent with the count pills**: it rendered as a grey radius-50% ellipse
  and sat FIRST in the strip on your own messages, reading as a broken first pill. It's now the
  same capsule chip as the count pills (Slack shape), with a subtle hover, ordered after them
  (CSS order only — DOM/focus order untouched).
- **Sidebar hover shape normalized**: GChat gives DM rows a full pill radius but space rows a small
  one; all rail rows now use the same squarish 6px radius (matches Slack and our active-row style).
- **Sidebar text darkened to match real Slack**: light-mode sidebar text was a too-light mid tone
  (e.g. aubergine `#743A7B`); it's now the accent blended 55% toward ink (`#3C1D3F` for aubergine —
  real Slack samples ≈ `#3E2B40`). Applies to built-in and custom themes.
- **Slack font on the conversation header title**: the header sits outside the message pane with
  Google Sans set explicitly, so Lato never reached it. The title span is now tagged for every
  conversation (spaces keep their "#") and gets Lato at Slack's heavy title weight; the base font
  is also set on `<body>` so any text without an explicit Google font inherits Lato.

## [1.2.2] — 2026-07-03

### Removed
- The Cmd/Ctrl+Shift+K shortcut: Google Chat already binds it natively for "New chat" (also `q`),
  and our capture-phase handler would have shadowed Google's own. The shortcuts feature is now
  Cmd/Ctrl+K only — additive by policy, never a combo Chat binds (press Shift+? in Chat for its
  native list).

## [1.2.1] — 2026-07-03

### Fixed
- The Help/Support menu in the top bar was unreadable (white-on-white): it renders inside the
  themed banner on a native light surface, so the banner white-text rule hit its items. Its ink is
  now restored the same way as the search dropdown (`[role="banner"] [role="menu"]`).

## [1.2.0] — 2026-07-03

### Added
- **Slack keyboard shortcuts** (opt-in, default OFF): Cmd/Ctrl+K focuses search (the quick-switcher
  muscle memory), Cmd/Ctrl+Shift+K starts a new chat. Additive only — it never overrides Chat's own
  shortcuts, and leaves the keystroke alone if its target element is missing.
- **Readable line width** (opt-in): caps messages and the compose box at ~1000px on wide windows,
  instead of edge-to-edge lines.
- The popup now groups the 25 toggles into titled sections (Theme & typography / Messages / Message
  details / Sidebar & Home / Keyboard shortcuts) and is wider (400px), so it scans much faster.

### Fixed
- Reaction chips on your own messages rendered broken (emoji pushed into the top-left corner,
  count misaligned, chip shrunken): the `selfslack` blanket alignment reset also hit the chips'
  centered flexboxes. The tagger now tags each reaction chip (`reaction-pill`) and its strip
  (`reactions`), and higher-specificity rules restore their native alignment.
- "Reaction pills" now actually rounds the reaction chip. `[data-emoji]` sits on the emoji `<img>`,
  so the old rule rounded the invisible image, not the pill; the chip is now capsule-shaped
  (Slack-style) via the new tag.
- Composer still showed Google's blue input pill inside the Slack-style box: the pill wash is
  painted by a full-size `::before` (and can live on a sibling overlay of the textbox, which the
  ancestor walk missed). Both are now flattened.
- Message hover toolbar was hard-coded white, leaving GChat's light dark-mode icons invisible on it
  in dark mode; its surface is now a per-mode variable (`--sf-toolbar-bg`).

## [1.1.0] — 2026-07-01

### Added
- **Custom themes**: create/name/delete your own themes from three anchor colors (sidebar /
  accent / top bar) with an in-popup 2D color picker; derived text/hover/ink use the same math
  as the built-in themes. Colors apply as-is in both light and dark modes.

### Fixed
- Search box text was invisible (white-on-white) in light mode.
- The collapsed sidebar's hover flyout was transparent, letting the message list bleed through.

## [1.0.0] — 2026-06-29

First public release — ready for the Chrome Web Store.

### Added
- Chrome Web Store assets in `store-assets/`: anonymized 1280×800 screenshots (Aubergine + Jade,
  light & dark) and the popup, plus small (440×280) and marquee (1400×560) promo tiles.
- `docs/STORE-LISTING.md` — ready-to-paste listing copy + privacy/permission answers; and
  `npm run package` to build the store zip locally.
- `tools/anonymize-for-screenshots.js` — paste-in console scrubber for privacy-safe screenshots.
- 32px toolbar icon (fixes a blank icon on Vivaldi / HiDPI Chromium toolbars).
- Tests for the `selfslack` name/time/grouping CSS contract and manifest icon integrity.

### Fixed
- `selfslack`: your own message's name and timestamp now sit on one line (the time no longer drops to
  a row of its own), and grouped follow-up messages hide the repeated avatar — Slack-style grouping.

### Changed
- CI runs on Node 24 and pins the public npm registry (fixes the `npm ci` auth failure).

## [0.16.0] — 2026-06-28

### Added
- **Slack-style own messages** (`selfslack`, default on): your own messages are left-aligned into the
  main column with your avatar and bold name, instead of right-aligned blue bubbles. The avatar and
  name are read from the account button into CSS variables and painted via pseudo-elements — no node
  is injected into Chat's message stream.
- **CI** (GitHub Actions): lint + syntax check + tests + an extension-contract validator on every push
  and PR; a tag-triggered release workflow that builds a clean, store-ready zip.
- **Tooling**: ESLint (flat config), EditorConfig, `.nvmrc`, `tools/validate-manifest.js` (enforces the
  permissions / no-network / version-sync rules as a hard gate), and behavioral tests for the build layer.

### Fixed
- Newly-sent messages now adopt the Slack layout immediately (Wiz re-render detection) instead of
  reverting to the right until you switched conversations and back.
- The "seen by" read-receipt thumbnail is no longer enlarged to a 36px square.

### Changed
- Renamed `themes.js` color helpers for readability and removed the dead `--sf-status-chip-text`
  variable. Synced the `package.json` version, fixed repository URLs, refreshed the README badges and
  theme list, and documented the two image requests in `SECURITY.md`.

## [0.12.0] — 2026-06-27

### Changed
- **Removed the experimental left-align self-messages feature** — kept Google Chat's native
  right-aligned blue self-bubbles (per user decision; left-align looked orphaned without an avatar).

### Fixed
- **Compose box** now actually renders as a Slack-style bordered box: the tagger tags the first
  opaque, wide composer ancestor (the white box wrapping input + toolbar) instead of the transparent
  inner layer it was tagging before.

## [0.11.0] — 2026-06-27

### Fixed
- **Inline code / `pre` text color** now applies (crimson light / orange dark) — the color also
  targets the text child, not just the wrapper.
- **Mention pills**: removed the white box behind the chip (GChat's inner anchor had its own opaque
  white background; inner backgrounds are now transparent so only the tinted pill shows).
- **Sidebar hover**: replaced GChat's grey hover fill with Slack's subtle theme-tinted hover (the
  grey sat on a `[role="link"]` the old rule missed), and the selected item now keeps its color on
  hover instead of turning grey.

### Changed
- **Left-align your messages** (`selfmessages`) is now **default OFF / experimental** — GChat gives
  self-messages no avatar, so left-aligned they look orphaned, and freshly-sent messages re-render
  back to the right. Kept as an opt-in toggle pending a better approach.

## [0.10.0] — 2026-06-27

### Added
- **Left-align your own messages** (`selfmessages`) — flips Google Chat's right-aligned self
  messages to the left (like Slack) with a subtle highlight band, so your messages are easy to spot
  despite having no avatar. The tagger detects the right-aligning flex containers (column
  `align-items:flex-end` / row `justify-content:flex-end` / `align-self:flex-end`) and flips them.
- **Slack-style compose box** (`composer`) — flattens the rounded pill composer into a bordered box.

### Changed
- **Light-mode sidebar now uses a pale tint** (e.g. aubergine `#F0E9F0`, jade `#E8F4F0`) with dark
  text and the vivid brand color reserved for the active item — matching the real Slack light theme
  (previously it used the saturated color as the whole sidebar).
- Reactions no longer crowd the next message under compact density (topic bottom padding).

### Fixed
- Suppress Google Chat's grey message-hover fill (incl. when the reaction toolbar appears) so only
  the subtle Slack-style row hover shows.

## [0.9.0] — 2026-06-27

### Added
- **Hide / Dim meetings from the Home feed** — two opt-in toggles (default off). Targets the
  Home-feed-only `data-group-type="10"` rows (verified 16/16; never present on sidebar rows), so
  the sidebar “Meetings” section is left untouched. Pure CSS, no `:has()`.
- **In-page “Hide meetings” switch** in the Home header, next to Chat’s own Unread toggle
  (`src/controls.js`). Writes to the same `chrome.storage.sync` the popup uses; fails safe if the
  anchor isn’t found.
- **Mode-reactive themes** — each theme now renders a saturated sidebar in **light** mode and a
  dark tint of the same hue in **dark** mode, like the real Slack client. Curated, sampled palette:
  Aubergine, Jade, Lagoon, Clementine, Banana, Barbra, Mood Indigo, Gray, Tritanopia
  (see `docs/SLACK-THEMES.md` §8, “sampled 2026-06-27”).
- **Mention pills** — inline @mentions styled as Slack-style tinted chips
  (`[data-user-mention-type]`), with mode-reactive colors.
- **Square avatars in the sidebar & Home list** — the tagger now tags circular avatar wrappers in
  the rail and Home feed (previously message-stream only).

### Changed
- Inline code uses mode-reactive color (crimson in light, orange in dark).
- Status-pill text is mode-reactive so it stays readable against its own background.

## [0.3.0] — 2026-06-27

### Added
- **Slack’s Lato typeface, bundled** (open-source, ~69 KB) and loaded from the extension’s own
  resources via `chrome.runtime.getURL` (no network, CSP-safe). New toggleable `typography`
  feature; font-family is set on containers only so Material icon fonts aren’t affected.
- **Automatic light/dark** — the skin now follows Google Chat’s own appearance (detected from
  the conversation background; re-checked on theme change). The manual light/dark toggle is gone.

### Fixed
- **Sidebar now themes the entire rail**, not just the Direct-messages box. The rail is resolved
  by walking up from the DM list to the highest sidebar-width ancestor that doesn’t contain the
  conversation pane (the whole rail is a `div`, not a single `c-wiz`).
- **Click-on-conversation sluggishness.** Message topics are now scanned **lazily via an
  IntersectionObserver** (visible ± one viewport only); off-screen history is never scanned until
  viewed, so switching conversations no longer triggers a full-history scan.

### Performance (review-driven; see docs/PERFORMANCE-REVIEW.md)
- MutationObserver callback is now **O(1)** (sets a dirty flag + schedules); all work happens in
  the chunked idle pass.
- Region work is **dirty-flag-gated**; scans **split reads from writes**; queries scoped to the
  rail/pane instead of `document`. Tests extended to enforce these.

### Performance (lightweight overhaul)
- **No `:has()` in the generated CSS.** The rail is now resolved in JS and tagged
  `data-slackify="rail"`; CSS targets the tag. This removes per-style-recalc `:has()` cost and
  fixes the conversation pane randomly flashing between white and aubergine (a broad `:has()`
  fallback was over-matching a container that wrapped the message area).
- **Idle-time tagging.** All work runs in `requestIdleCallback` and is throttled to one pass per
  idle slot; the `MutationObserver` now only collects nodes (no inline computation).
- **Cache everything one-time.** Per-topic scan cached in a `WeakSet` (each message scanned once,
  not on every re-render); rail light-button scan cached per rail; active-row cached by group-id;
  rail/stream early-return once resolved. Measured: an idle pass performs **0** `getComputedStyle`
  calls; first paint stays correct.
- Removed layout reads (`offsetWidth`/`getBoundingClientRect`) from the hot path.
- Fixed date dividers that live outside message topics (string-only pane scan, cached).

### Added
- `test/performance.test.js` + `npm test` (Node's built-in runner, zero deps) that enforces the
  performance contract: no `:has()` in CSS, idle-scheduled + throttled tagger, collect-only
  observer, and WeakSet caching. Documented the doctrine in `CLAUDE.md`.

## [0.2.0] — 2026-06-27

### Added
- **Configurable architecture**: single source of truth for selectors with fallback chains
  (`src/config.js`); stylesheet generated from config (`src/styles.js`).
- **12 Slack themes** (Aubergine, Monument, Choco Mint, Ochin, Work Hard, Hoth, Space Gray,
  Dracula, Netflix, Mint, Clean, High Contrast) with verified hex values.
- **Light/dark mode** for message-area accents, independent of the sidebar theme.
- **Per-feature toggles** (10 features) gated by `html[data-sf-feat-*]` attributes.
- **Popup settings UI** backed by `chrome.storage.sync` (master switch, theme, mode, features).
- **Visual fixes**: full-width/left-aligned messages (Slack-style), sidebar hover keeps theme
  colors, Slack-style date dividers (pill on a divider line).
- **Locale-independent fallback selectors** (data-group-id based) so the skin survives
  non-English Chat UIs.
- Docs: `docs/EXTENSION-BEST-PRACTICES.md`, `docs/SLACK-THEMES.md`, `CLAUDE.md`.
- Open-source scaffolding: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue/PR templates.

### Changed
- Split content scripts: CSS-bearing scripts run at `document_start` (less FOUC), tagger at
  `document_idle`.
- Bubble detection lowered to `border-radius >= 4px` and now skips monospace (keeps code blocks).
- Added the `storage` permission (settings only; no host/network access).

### Removed
- `src/selectors.js` and `src/content.css` (superseded by `config.js` + generated styles).

## [0.1.0] — 2026-06-27

### Added
- Initial proof of concept: aubergine sidebar + top bar, flattened message bubbles, active-row
  highlight, all targeting durable hooks (no hashed classes). MV3, zero permissions.
