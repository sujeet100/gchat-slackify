# Extension Best Practices — Slackify for Google Chat

Reference guide for building and maintaining this MV3 content-script theme. It is
written **specifically for this codebase** (the durable-selector / `data-slackify`
tagging architecture described in the [README](../README.md)), not as a generic MV3
tutorial. Every recommendation is checked against current (2025–2026) Chrome guidance,
with inline source links.

The project's three non-negotiable values, in priority order:

1. **Security** — minimal permissions, no network, no remote code, fully auditable.
2. **Durability** — survive Google Chat's frequent DOM/CSS-hash churn.
3. **Clean, maintainable JS/CSS** — one source of truth, defensive, cheap.

---

## Rules for Claude / contributors (read this first)

A checklist an AI agent (or human) can follow when editing this repo. If a change
violates one of these, stop and reconsider.

1. **Never target a hashed/auto-generated class** (`.EAOoq`, `.pGxpHc`, …). They are
   recomputed on every Google build. Target only durable hooks: ARIA `role`,
   `aria-label`, semantic `data-*`, or `:has()` relations. This is the rule the whole
   project exists to enforce — see [`src/selectors.js`](../src/selectors.js).
2. **All targeting lives in one place.** Every selector goes in
   [`src/selectors.js`](../src/selectors.js); the CSS in
   [`src/content.css`](../src/content.css) targets only those hooks plus our own
   `[data-slackify="…"]` tags. Don't scatter selectors across files. Keep
   [`tools/health-check.js`](../tools/health-check.js) in sync when you add a critical
   selector.
3. **Add no permission you don't strictly need.** Today the manifest requests *zero*
   permissions (only content-script `matches`). If a feature needs settings, add
   `"storage"` and nothing else — never `tabs`, `<all_urls>`, `webRequest`, `cookies`,
   `scripting`, or host permissions beyond Chat. Each new permission risks Web Store
   review and erodes the privacy posture.
4. **No network, ever.** No `fetch`/`XHR`/`WebSocket`/`sendBeacon`, no analytics, no
   third-party scripts, no remote fonts/CSS/images. The extension must remain
   *technically incapable* of exfiltrating data. This is a load-bearing privacy claim
   in [`PRIVACY.md`](../PRIVACY.md).
5. **No `eval` / `new Function` / remote code.** MV3 forbids it and the CSP blocks it;
   don't try to work around it. All code ships in the package.
6. **The host app must never break.** Wrap every DOM read/derive in `try/catch` (as
   [`src/tagger.js`](../src/tagger.js) already does). A theme that throws into Google's
   app is worse than no theme.
7. **Prefer CSS over JS.** Only fall back to JS tagging for elements that genuinely
   have no durable native hook (the grey bubble, the active row, light buttons in the
   dark rail). If CSS `:has()` can reach it, do it in CSS.
8. **Keep the observer cheap.** Tag newly-added nodes only; debounce broader passes to
   one `requestAnimationFrame`; never re-scan the whole document on every mutation.
9. **Read-only on the page, except our own attribute.** The only thing we write to the
   page DOM is `data-slackify`. We never mutate Chat's content, attributes, or state.
10. **When something breaks, fix one line.** Run [`tools/health-check.js`](../tools/health-check.js),
    find the dead hook, fix it in `selectors.js` + the matching CSS rule, bump the
    version, reload. No archaeology.

---

## 1. MV3 manifest & content scripts

The current [`manifest.json`](../manifest.json) uses a single static content-script
declaration. Statically-declared scripts under `"content_scripts"` are the right tool
when the match set is known up front (it is: Chat only), and they require no
`"scripting"` permission.
([Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))

### `run_at` — and the FOUC problem

`run_at` controls when our files inject. The current value is `"document_idle"` (the
default), which runs **after** DOM construction. For an *injected-CSS theme* that is
the main cause of **FOUC (flash of unstyled content)**: Chat renders in Google's own
colors for a beat, then snaps to the Slack skin.

- **For the CSS, prefer `"document_start"`.** Declarative CSS listed in the manifest's
  `"css"` field is *"injected in the order they appear in this array, before any DOM is
  constructed or displayed for the page."* Combined with `run_at: "document_start"`,
  the stylesheet is in place before the first paint, eliminating most FOUC.
  ([content_scripts manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts),
  [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))
- **The JS tagger is different.** `tagger.js` reads computed styles and queries the
  rendered DOM, so it *needs* the DOM to exist. Running it at `document_start` would
  find nothing. The right pattern is to **split timing**: inject CSS early, run JS
  later. With a single declaration you cannot mix `run_at` values, so either:
  - keep one declaration at `document_idle` but accept the CSS targets durable hooks
    that mostly exist by first paint (today's behavior), **or**
  - use **two declarations** — one `{ "css": [...], "run_at": "document_start" }` and
    one `{ "js": [...], "run_at": "document_idle" }`. This is the recommended upgrade
    for reducing FOUC without breaking the tagger.

> Caveat for SPAs like Wiz/Chat: Chat is a single-page app that renders most of its UI
> *after* initial load via JS, so `document_start` only helps the very first paint. The
> `MutationObserver` in `tagger.js` is what keeps the skin applied as Chat swaps views.
> CSS that targets stable hooks (e.g. `header[role="banner"]`) applies the instant
> those nodes appear, regardless of `run_at`.

### `all_frames`

The manifest sets `"all_frames": true`. *"`all_frames` allows the extension to specify
if JavaScript and CSS files should be injected into all frames matching the URL
requirements or only into the topmost frame."*
([content_scripts manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts))
Chat renders some surfaces (e.g. the embedded Chat in Gmail at
`mail.google.com/chat/*`) inside iframes, so `all_frames: true` is correct here. Leave
it on unless profiling shows it injecting into irrelevant frames.

### Declarative `"css"` vs `chrome.scripting.insertCSS()`

Use the **declarative `"css"` field** (as we do). It needs no permission, injects
before paint, and is removed automatically when the extension unloads.
`chrome.scripting.insertCSS()` is for *dynamic* injection decided at runtime; it
requires the `"scripting"` permission and host permission, and runs later (more FOUC).
We have a known, fixed target set, so declarative wins on every axis that matters here.
([Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))

### ISOLATED vs MAIN world

Content scripts default to the **ISOLATED** world — *"a private execution environment
that isn't accessible to the page or other extensions."*
([Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))
Keep it. ISOLATED still has full access to the page **DOM** (which is all the tagger
needs), while keeping our JS variables sandboxed from Chat's own scripts — safer and
less likely to collide with Wiz internals. **MAIN** world would only be needed to call
into the page's own JS objects, which we never do. Never switch to MAIN for a CSS theme.

---

## 2. Security & least-privilege

This is the project's headline value. Keep it true.

- **Fewest permissions.** Today: none beyond content-script `matches`. The only
  permission a settings UI should ever add is `"storage"`. Requesting excessive
  permissions is one of the top Chrome Web Store rejection reasons (see §9).
- **No remote code (enforced by CSP).** MV3 *"does not allow remote URLs in
  `script-src` of `extension_pages`"*, and *"`eval()` and similar functions (e.g.
  `new Function()`) are blocked by default,"* with no way to add `'unsafe-eval'`.
  ([CSP manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy),
  [Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security))
  All logic ships in this repo. Don't fetch, inject, or `eval` anything.
- **Why a content script can read the page DOM — and how we stay trustworthy.** Any
  content script on Chat *can* see the rendered DOM, which includes message text. The
  ISOLATED world doesn't change that. Our defense isn't access control, it's
  *capability removal*: with no network code and no host permissions, there is nowhere
  to send anything. State this plainly (we do, in [`PRIVACY.md`](../PRIVACY.md)) and
  keep the source open so the claim is auditable line-by-line.
- **Auditability.** Keep the codebase small, unminified, and dependency-free. The whole
  extension should be readable in one sitting. Don't add a bundler that obfuscates
  output (obfuscated code is an explicit rejection reason — §9). If you adopt
  TypeScript (§6), commit the readable compiled JS *and* the TS so reviewers can diff.
- **Privacy posture.** No analytics, no telemetry, no "anonymous usage stats," no error
  reporting to a server. If you ever want crash insight, log to `console`, not a
  network endpoint.

---

## 3. Resilience to host DOM changes

The reason every prior "Slack theme for Google Chat" died. Our entire architecture is a
response to it.

### Prefer semantic hooks over hashed classes

Target, in order of preference:

1. **ARIA `role`** — `role="banner"`, `role="search"`, `role="list"`, `role="listitem"`,
   `role="main"`, `role="textbox"`. These encode behavior and accessibility; Google
   can't rename them without breaking screen readers and their own app.
2. **Semantic `data-*`** — `data-group-id`, `data-topic-id`, `data-is-unread`,
   `data-starred`, `data-emoji`. These encode state/identity that Chat's own JS relies
   on.
3. **`aria-label`** — `"List of Direct Messages"`, `"List of spaces."` (used via
   `:has()` to reach the rail). **But see the i18n caveat below.**

Never target Wiz hash classes. See the rationale in
[`src/selectors.js`](../src/selectors.js).

### Fallback selector chains (primary + fallbacks)

A single selector is a single point of failure. Where a hook is plausibly volatile,
define a **chain** — try the most specific durable selector first, fall back to broader
ones. Pattern to adopt in `selectors.js`:

```js
// Resolve the first selector in a chain that actually matches something.
function resolve(chain, root = document) {
  for (const sel of chain) {
    try {
      const el = root.querySelector(sel);
      if (el) return { el, used: sel };
    } catch (_) { /* invalid selector after a Chrome update — skip */ }
  }
  return { el: null, used: null };
}

const SELECTOR_CHAINS = {
  // most-durable first, broader fallback second
  sidebarRail: [
    'c-wiz:has([aria-label="List of Direct Messages"])',
    'c-wiz:has([role="list"][aria-label*="Direct Messages"])',
    'c-wiz:has([role="navigation"])',
  ],
};
```

For pure CSS, the comma in a selector list *is* a fallback chain — list a primary and a
fallback rule so that if one hook dies the other still styles the element.

### Centralize, observe, defend

- **Centralize:** one config (`selectors.js`). Already the design.
- **Re-tag on mutation:** the `MutationObserver` in
  [`src/tagger.js`](../src/tagger.js) re-derives hook-less elements as Chat swaps views.
- **Defensive `try/catch`:** every derive is wrapped so a Chrome change that makes a
  selector invalid degrades the *theme*, never Chat. Keep this discipline.

### The i18n caveat (important, currently unmitigated)

**`aria-label` text is localized.** `"List of Direct Messages"` becomes
`"Liste des messages directs"`, `"ダイレクト メッセージのリスト"`, etc. for non-English
UIs — so our `aria-label`-based selectors (the rail `:has()`, `dmList`, `spacesList`)
**silently break for any user whose Chat is not in English.** Mitigations, best first:

1. **Prefer language-independent hooks** where one exists: `role`, `data-*`, and stable
   DOM structure don't change with locale. Reach the rail via a structural/`role`
   relationship rather than label text where possible.
2. **Match on a stable attribute *near* the label** rather than the translated string.
3. **Multi-locale fallback chain:** if you must match label text, include the known
   translations in the chain (high maintenance — last resort).
4. **At minimum, document the limitation** (English-UI assumption) in the README and
   detect it in `health-check.js` so non-English breakage is diagnosable.

---

## 4. Performance

A theme should be invisible in the profiler. Current `tagger.js` already follows most
of this; keep it that way.
([MutationObserver guidance](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver),
[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts))

- **Scope observer work to `addedNodes`.** Process only nodes that were actually added
  (as `tagBubblesIn(n)` does per added node), not a full-document rescan per mutation.
- **Debounce with `requestAnimationFrame`.** The light pass (`tagLightButtons`,
  `tagActiveRow`) is coalesced to one rAF via the `scheduled` flag — keep this; don't
  run expensive passes synchronously inside the callback.
- **Avoid layout thrashing.** `getComputedStyle()` forces a synchronous layout/style
  recalc. Calling it in a tight loop over many nodes interleaved with writes is the
  classic thrash. Mitigations: gate calls with cheap pre-checks first
  (`offsetWidth <= 40`, has text, not already tagged — as the bubble tagger does);
  batch all reads, then all writes; never read-write-read in a loop.
- **Prefer CSS over JS.** CSS `:has()`/attribute rules run on the engine's optimized
  path. Every element you can reach in CSS is one you don't pay for in the observer.
- **Watch `:has()` cost on mutation.** Browsers re-evaluate `:has()` selectors on DOM
  changes; keep the inner selector tight and prefer child/sibling combinators to limit
  traversal. ([:has() — caniuse](https://caniuse.com/css-has),
  [MDN :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has))
- **Disconnect when idle if you ever can.** We can't (Chat mutates continuously), but
  if a future feature adds a short-lived observer, `disconnect()` it when done.

---

## 5. CSS injection technique

Conventions already used in [`src/content.css`](../src/content.css), with the reasoning.

- **CSS custom properties for theming.** The palette lives in `:root` as
  `--slackify-aubergine`, `--slackify-active`, etc. Custom properties cascade and
  inherit, so a future light/dark or per-Slack-theme switch is a single set of variable
  overrides rather than a rewrite. Keep all tunable colors as variables; keep them in
  sync with the `THEME` knobs documented in `selectors.js`.
  ([MDN custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties))
- **`:has()` to reach containers via stable descendants.** We can't name the rail
  directly, so we reach it as `c-wiz:has([aria-label="List of Direct Messages"])` — the
  container is selected via a durable child. This is the core durability trick on the
  CSS side. `:has()` is Baseline since 2023 (Chrome/Edge 105+, Firefox 121+, Safari
  15.4+), so it's safe to rely on. ([:has() — caniuse](https://caniuse.com/css-has))
- **`!important` discipline.** We're overriding a heavily-specific host stylesheet, so
  `!important` is justified here (overriding third-party styles is a legitimate use).
  But keep it deliberate: prefer raising specificity via the durable hook first; reach
  for `!important` only to beat Wiz's inline/hashed rules. Don't sprinkle it — every
  `!important` you add is one a future contributor must out-`!important` to tweak.
  ([MDN !important](https://developer.mozilla.org/en-US/docs/Web/CSS/important))
- **Specificity management.** Prefix override rules with the region selector (e.g. the
  rail's `lightbtn` rule is prefixed with the rail `:has()` selector so it wins over the
  rail's light-text rule). Keep related rules grouped by region, as the file already is.
- **Attribute-gated feature toggles on a root element.** For optional features
  (narrower sidebar, dark variant, `#`-prefixed channels), gate them with an attribute
  on a root the page already exposes, e.g.:

  ```css
  html[data-slackify-theme="dark"]  c-wiz:has([aria-label="List of Direct Messages"]) { /* dark rail */ }
  html[data-slackify-density="compact"] c-wiz[data-topic-id] { padding: 0 !important; }
  ```

  The tagger (or a settings reader) sets `data-slackify-theme` / `-density` on
  `<html>`; the CSS ships all variants and the attribute selects one. No per-feature
  stylesheet juggling.

---

## 6. JS/TS code quality

- **Structure.** Keep the current shape: `selectors.js` = data/config only;
  `tagger.js` = behavior. Each file is an IIFE that reads/writes `globalThis.SLACKIFY`.
  Don't introduce a module bundler unless a real need appears — content scripts ship as
  plain files and the current setup needs no build step.
- **No `eval` / `new Function` / dynamic code.** Blocked by CSP anyway (§2); also just
  don't. ([Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security))
- **Defensive by default.** Every DOM derive in `try/catch`; null-check every
  `querySelector`; use `CSS.escape()` when building selectors from runtime values (as
  `tagActiveRow` already does).
- **Optional TypeScript setup.** MV3 ships JS, so TS is purely a dev-time aid — you must
  compile to plain JS that the manifest references. Minimal approach:
  - `tsconfig.json` with `"target": "ES2022"`, `"module": "ESNext"`,
    `"strict": true`, `"outDir": "src"` (or a `dist/` the manifest points at).
  - Author `selectors.ts` / `tagger.ts`; build with `tsc`; reference the emitted `.js`
    in the manifest.
  - **Commit both** the `.ts` and the readable emitted `.js` so Web Store reviewers and
    auditors can read shipped code without a build (avoids the "obfuscated code"
    rejection — §9).
  - Keep emit unminified. The value is type-checking the selector config and tagger,
    not shrinking bytes.
- **Linting.** Add ESLint (flat config) with the recommended ruleset plus a rule
  banning `eval`/`new Function` and flagging `fetch`/`XMLHttpRequest`/`WebSocket` usage
  — turn the project's network-free promise into an enforced lint rule. No network or
  framework plugins needed.

---

## 7. Testing

The project is cosmetic and self-contained, so "a break is always a visual one" — that
makes testing tractable. See [`tools/SMOKE-TEST.md`](../tools/SMOKE-TEST.md).

- **Selector health checks.** [`tools/health-check.js`](../tools/health-check.js)
  verifies every critical selector still resolves; run it after any Chat update or as a
  scheduled job. Keep its `CRITICAL`/`OPTIONAL` lists in sync with `selectors.js`. This
  is the cheapest early-warning system.
- **Visual-regression via screenshots (Chrome DevTools MCP).** Screenshot the same
  views (conversation list, open Space, open DM) on a schedule and diff against a
  known-good baseline. With the DevTools MCP: `navigate_page` →
  `https://chat.google.com/`, `take_screenshot`, diff. A large delta in the
  rail/top-bar/message area = likely break → run the health check to localize. This is
  the recommended automatable CI per the smoke-test doc.
- **Manual smoke checklist.** Run the checklist in
  [`tools/SMOKE-TEST.md`](../tools/SMOKE-TEST.md) after any Google Chat update: rail
  aubergine + readable text, "New chat" button dark text, active row Slack-blue,
  unreads bold, top bar aubergine, flat dense messages, and — critically — **Chat still
  works functionally** (send, search, threads, reactions).

---

## 8. `chrome.storage` best practices (for a settings UI)

Relevant once the roadmap's on/off toggle / theme picker lands. Adding `"storage"` is
the *only* new permission this should require.
([chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage))

- **`sync` vs `local`.** Use **`storage.sync`** for user preferences (theme on/off,
  variant, density) so they follow the user across signed-in browsers. Quota is small
  — ~**100 KB total, 8 KB per item** — which is plenty for a handful of prefs. Use
  **`storage.local`** only for larger data (~10 MB); we have none, so prefer `sync`.
  ([chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage))
- **React with `storage.onChanged`.** Apply settings live by listening to
  `chrome.storage.onChanged` in the content script and flipping the root attribute
  (e.g. `document.documentElement.setAttribute('data-slackify-theme', value)`), so the
  popup and the page stay in sync without a reload.
- **Defaults & migrations.** Always read with a defaults object and merge, so a missing
  key never breaks the theme:

  ```js
  const DEFAULTS = { enabled: true, theme: 'aubergine', density: 'comfortable', _v: 1 };
  const prefs = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  // migration: if a stored _v is older than DEFAULTS._v, transform then write back.
  if (prefs._v < DEFAULTS._v) { /* migrate keys */ prefs._v = DEFAULTS._v;
    await chrome.storage.sync.set(prefs); }
  ```

  Version your schema (`_v`) from day one so future renames are migratable.
- **Stay graceful if `storage` is absent.** If the toggle ships behind a flag, the
  content script should fall back to "enabled" defaults when `chrome.storage` is
  undefined, preserving the zero-config experience.

---

## 9. Chrome Web Store publishing (open-source extension)

Steps and pitfalls for shipping this to the Web Store. Sources:
[Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish),
[Review process](https://developer.chrome.com/docs/webstore/review-process),
[Distribution setup](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution),
[Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies),
[User-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

- **Developer account.** One-time **$5** registration fee on the Chrome Web Store
  developer dashboard; one account can publish up to ~20 items.
  ([Publish](https://developer.chrome.com/docs/webstore/publish))
- **Review process & timelines.** Most extensions are reviewed within ~**24 hours to
  1–3 business days**; it can occasionally take weeks. If pending >3 weeks, contact
  developer support. Every visibility setting (public *and* unlisted) goes through the
  same review.
  ([Review process](https://developer.chrome.com/docs/webstore/review-process))
- **Privacy / data-use disclosures (required).** In the dashboard you must complete the
  data-collection disclosures and certify **Limited Use**. For this extension the
  honest answers are: collects no user data, no sale/transfer, used only for the
  single advertised purpose. Provide a privacy policy URL — we already have
  [`PRIVACY.md`](../PRIVACY.md); host it (e.g. the repo or GitHub Pages) and link it.
  ([User-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
  [Privacy policies](https://developer.chrome.com/docs/webstore/program-policies/privacy))
- **Permissions justification.** Justify the host access to
  `chat.google.com` / `mail.google.com/chat` (needed for the cosmetic content script).
  The zero-extra-permissions posture makes this section trivial and review-friendly.
- **Required icons & listing assets.** Provide the icon set (commonly 16/32/48/128 px;
  128 px is required for the store) — currently missing per the README's
  [`icons/`](../icons/) note. Add a 128×128 icon, reference icons in the manifest,
  write a clear description, and supply at least one screenshot (1280×800 or
  640×400) plus the store listing copy.
- **Unlisted vs public.** **Unlisted** = installable only via direct URL, not surfaced
  in search/browse — ideal for a beta or sharing with a few users. **Public** = listed
  and searchable. Same policies and review either way; you can switch later.
  ([Distribution setup](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution))
- **Semantic versioning.** Bump `manifest.json` `"version"` on every upload (the store
  requires a strictly higher version). Use `MAJOR.MINOR.PATCH`; patch for selector
  fixes, minor for features (dark theme, toggle), major for breaking UX changes.
- **What gets extensions rejected** (avoid all of these — we already do):
  - **Obfuscated/minified-beyond-recognition code** — ship readable JS (see §6).
  - **Over-broad permissions** — we request the minimum; don't regress.
  - **Missing/incomplete privacy policy or data disclosures** — keep
    [`PRIVACY.md`](../PRIVACY.md) accurate and linked.
  - **Incomplete/misleading listing** — description must match behavior ("cosmetic
    restyle, no data leaves the browser").
  - **Remote code** — none; MV3 + our CSP forbid it.
  - **Broken functionality** — run the smoke test before every upload.
  ([Review process](https://developer.chrome.com/docs/webstore/review-process),
  [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies))
- **Trademark caution.** "Slack" and "Google Chat" are trademarks; keep the
  not-affiliated disclaimer (already in the README) in the listing to reduce
  trademark/impersonation rejection risk.

---

### Sources

- [Content scripts — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Manifest: content_scripts — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Manifest: Content Security Policy — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Improve extension security — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- [chrome.storage API — Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process)
- [Prepare to publish: set up distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [User data FAQ / data disclosures](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Privacy policies — program policies](https://developer.chrome.com/docs/webstore/program-policies/privacy)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [MDN: :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has) · [caniuse :has()](https://caniuse.com/css-has)
- [MDN: !important](https://developer.mozilla.org/en-US/docs/Web/CSS/important)
