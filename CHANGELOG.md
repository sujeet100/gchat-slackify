# Changelog

All notable changes to this project are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
