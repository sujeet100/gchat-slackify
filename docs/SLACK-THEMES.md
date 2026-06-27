# Slack Sidebar Themes — color reference

Research reference for translating Slack's sidebar themes into CSS custom-property sets
for this extension's roadmap (light/dark default, theme picker). Every value below is
sourced; values that could **not** be verified are called out explicitly rather than
guessed.

> **Scope note.** This documents Slack's *classic sidebar theme model* — the
> 8-color comma-separated string Slack has used for years for sidebar customization. The
> 2022 "new visual language" redesign introduced named presets (Banana, Sweet Treat,
> Jaguar, etc.) that also recolor the **top nav** and message area; Slack does **not**
> publish hex codes for those, so they are listed separately as *unverified* at the end.

---

## 1. The 8-color slot model

A classic Slack theme is a comma-separated string of **8 hex colors**, in this fixed
order:

| # | Slot | What it colors |
| - | --- | --- |
| 1 | **Column BG** | The main sidebar/column background color |
| 2 | **Menu BG Hover** | Background when hovering the workspace name at the top of the sidebar |
| 3 | **Active Item** | Background of the selected channel / DM |
| 4 | **Active Item Text** | Text color of the selected item |
| 5 | **Hover Item** | Background when hovering a channel / DM (not selected) |
| 6 | **Text Color** | The sidebar's main text color |
| 7 | **Active Presence** | The "online" presence dot next to a username |
| 8 | **Mention Badge** | The unread-mention / notification badge background |

Source for slot meanings:
[Best Slack Themes (Suptask)](https://www.suptask.com/blog/best-slack-themes),
corroborated by
[Create a Theme (slack-themes.vercel.app)](https://slack-themes.vercel.app/create-a-theme)
and [How to change Slack's sidebar theme (Gadget Hacks)](https://smartphones.gadgethacks.com/how-to/change-slacks-sidebar-theme-your-iphone-android-phone-for-customized-colors-0194708/).

> Newer Slack builds added extra slots (e.g. top-nav background/text) in some sharing
> formats, but the **8-color model above is the durable, widely-documented one** and the
> one the values in this doc use. Treat any 9th/10th value you encounter elsewhere as a
> top-nav extension of this base.

---

## 2. Slack's built-in (preset) themes

These are the themes Slack itself ships in **Preferences → Themes**. Two
independent sources agree the classic preset set is: **Aubergine, Aubergine Classic,
Hoth, Monument, Choco Mint, Ochin, Work Hard**, plus two vision-assistive themes.
([G2 — Slack Themes](https://learn.g2crowd.com/slack-themes),
[Suptask](https://www.suptask.com/blog/best-slack-themes))

Hex values below are from the widely-mirrored
[`paracycle/slackthemes` `themes.yml`](https://github.com/paracycle/slackthemes/blob/master/data/themes.yml)
dataset (the canonical community archive of Slack theme strings), cross-checked against
[`sachinh19/slack-themes`](https://github.com/sachinh19/slack-themes) where present.

> **Reliability note.** The "Aubergine" string below (`#3F0E40,…`) matches Slack's
> *current* default and is the same `#3F0E40` already used as `--slackify-aubergine` in
> [`src/content.css`](../src/content.css) — high confidence. The other preset strings
> are from the community dataset and match across mirrors, but **Slack has never
> published an official hex table**, so treat them as community-verified, not
> first-party. The "Active Item" column for several presets in the community data is the
> Slack-blue family (`#1164A3` etc.), consistent with current Slack.

| Theme | Light/Dark | 1 Column BG | 2 Menu Hover | 3 Active Item | 4 Active Text | 5 Hover Item | 6 Text | 7 Presence | 8 Mention Badge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Aubergine** (current default) | Dark | `#3F0E40` | `#350D36` | `#1164A3` | `#FFFFFF` | `#350D36` | `#FFFFFF` | `#2BAC76` | `#CD2553` |
| **Hoth** | **Light** | `#F8F8FA` | `#F8F8FA` | `#2D9EE0` | `#FFFFFF` | `#FFFFFF` | `#383F45` | `#60D156` | `#DC5960` |
| **Monument** | Dark (teal) | `#0D7E83` | `#076570` | `#F79F66` | `#FFFFFF` | `#D37C71` | `#FFFFFF` | `#F79F66` | `#F15340` |
| **Choco Mint** | Dark | `#544538` | `#42362B` | `#5DB09D` | `#FFFFFF` | `#4A3C30` | `#FFFFFF` | `#FFFFFF` | `#5DB09D` |
| **Ochin** | Dark | `#303E4D` | `#2C3849` | `#6698C8` | `#FFFFFF` | `#4A5664` | `#FFFFFF` | `#94E864` | `#78AF8F` |
| **Work Hard** | Dark | `#4D5250` | `#444A47` | `#D39B46` | `#FFFFFF` | `#434745` | `#FFFFFF` | `#99D04A` | `#DB6668` |

**Could not verify (left out rather than guessed):**

- **Aubergine Classic** — named as a preset by both
  [G2](https://learn.g2crowd.com/slack-themes) and
  [Suptask](https://www.suptask.com/blog/best-slack-themes), but **no reliable 8-color
  string was found** for it in the community datasets (the historical pre-2018 default
  used a `#4D394B` column, e.g. the legacy "Aubergine" string
  `#4D394B,#5D475C,#8A7B89,#FFFFFF,#5D475C,#FFFFFF,#38978D,#E01E5A` seen in older lists
  — but I cannot confirm that this is exactly what Slack currently labels "Aubergine
  Classic," so it is intentionally **not** placed in the table above).
- **Vision-assistive themes** — Slack ships two for color-blindness
  ([Slack help](https://slack.com/help/articles/205166337-Change-your-Slack-theme));
  their hex values are not published.

---

## 3. Other commonly-cited named themes (community / legacy)

Not first-party presets today, but frequently referenced and present in the canonical
dataset, so usable as ready-made palettes. From
[`paracycle/slackthemes` `themes.yml`](https://github.com/paracycle/slackthemes/blob/master/data/themes.yml).

| Theme | Light/Dark | 1 Column BG | 2 Menu Hover | 3 Active Item | 4 Active Text | 5 Hover Item | 6 Text | 7 Presence | 8 Mention Badge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Slack White** (a.k.a. "Clean") | **Light** | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#2288CC` | `#2288CC` | `#454449` | `#93CC93` | `#2288CC` |
| **High Contrast** | **Light** | `#FFFFFF` | `#999999` | `#000000` | `#FFFFFF` | `#AAAAAA` | `#000000` | `#808080` | `#000000` |
| **Space Gray** | Dark | `#303E4D` | `#2C3849` | `#B04C58` | `#FFFFFF` | `#4A5664` | `#B3B8C4` | `#94E864` | `#78AF8F` |
| **Dracula** | Dark | `#282A36` | `#44475A` | `#44475A` | `#8BE9FD` | `#6272A4` | `#FFFFFF` | `#50FA7B` | `#FF5555` |
| **Netflix** | Dark | `#1F1C18` | `#8E0E00` | `#8E0E00` | `#FFFFFF` | `#A1A09F` | `#FFFFFF` | `#B01D0C` | `#8E0E00` |
| **Mint** | Dark | `#212420` | `#333632` | `#87CF3E` | `#FFFFFF` | `#393D39` | `#FFFFFF` | `#87CF3E` | `#68A030` |

> "Clean" is the common nickname for Slack's all-white sidebar; the dataset stores it as
> **Slack White** (`#FFFFFF` column). Confidence: medium for the nickname mapping, high
> for the hex string itself (it appears verbatim across mirrors).

---

## 4. Themes named in the prompt that I could NOT verify

Honesty over guessing — the following were requested but have **no reliable hex source**
I could find. Slack's 2022 redesign introduced several of them, but Slack publishes only
*color descriptions*, not hex codes
([Slack Design — "A new visual language for Slack"](https://slack.design/articles/a-new-visual-language-for-slack/)).

| Theme | Status | What's known |
| --- | --- | --- |
| **Banana** | Unverified | Real 2022 preset; described as "a yellow primary color." No published hex. |
| **Sweet Treat** | Unverified | Referenced as a preset name; no hex found in any reliable source. |
| **Jaguar** | Unverified | Referenced as a preset name; no hex found. |
| **Nocturne** | Unverified | Referenced as a dark preset; no hex found. |
| **Mountain Berry** | Unverified | Referenced as a preset name; no hex found. |
| **Expensive** | Unverified | Referenced as a preset name; no hex found. |
| **Tritone variants** | Unverified | Vision-assistive family; Slack ships them but does not publish hex values. |
| **Barbra** | Unverified | Named in Slack's redesign article as "a bright pink color"; no hex published. |
| **Aubergine Classic** | Unverified | Named as a preset (see §2); no confirmed current 8-color string. |

If you need these for the extension, the safe path is to **sample them live** from a
Slack client (DevTools → computed `background-color` on the sidebar, active item,
hover, badge, presence dot) and record the values here with a "sampled YYYY-MM-DD"
note, rather than copying numbers from unverified blog posts.

---

## 5. Dark vs light, for driving a default

For a light/dark toggle, classify by **Column BG luminance** (slot 1):

- **Dark themes** (light text on dark rail — the Slack-default feel this extension
  targets): **Aubergine**, Monument, Choco Mint, Ochin, Work Hard, Space Gray, Dracula,
  Netflix, Mint.
- **Light themes** (dark text on near-white rail): **Hoth**, **Slack White / "Clean"**,
  **High Contrast**.

Recommended defaults for this extension:

- **Dark default → Aubergine** (`#3F0E40`) — already the project's `--slackify-aubergine`
  and Slack's own default. No change needed.
- **Light default → Hoth** (`#F8F8FA`) — Slack's canonical light preset, so it reads as
  "Slack light" rather than a generic white.

---

## 6. Translating to CSS custom properties

The 8 slots map cleanly onto a CSS variable set. This extension currently uses a smaller
palette in [`src/content.css`](../src/content.css) (`--slackify-aubergine`,
`--slackify-active`, …); the table below shows how the full Slack model lines up so a
theme picker can drop in any palette.

| Slack slot | Suggested CSS variable | Current `content.css` analog |
| --- | --- | --- |
| 1 Column BG | `--slackify-rail-bg` | `--slackify-aubergine` |
| 2 Menu BG Hover | `--slackify-rail-menu-hover` | (n/a yet) |
| 3 Active Item | `--slackify-active` | `--slackify-active` |
| 4 Active Item Text | `--slackify-active-text` | hard-coded `#ffffff` |
| 5 Hover Item | `--slackify-hover` | `rgba(255,255,255,.10)` (hard-coded) |
| 6 Text Color | `--slackify-rail-text` | `--slackify-rail-text` |
| 7 Active Presence | `--slackify-presence` | (n/a yet) |
| 8 Mention Badge | `--slackify-badge` | (n/a yet) |

### JS object — ready to convert a Slack string into variables

```js
// Order matches Slack's 8-color theme string (see §1).
const SLACK_SLOTS = [
  '--slackify-rail-bg',          // 1 Column BG
  '--slackify-rail-menu-hover',  // 2 Menu BG Hover
  '--slackify-active',           // 3 Active Item
  '--slackify-active-text',      // 4 Active Item Text
  '--slackify-hover',            // 5 Hover Item
  '--slackify-rail-text',        // 6 Text Color
  '--slackify-presence',         // 7 Active Presence
  '--slackify-badge',            // 8 Mention Badge
];

// Verified built-in palettes (see §2). 'dark' drives the light/dark default (§5).
const SLACK_THEMES = {
  aubergine:  { dark: true,  colors: ['#3F0E40','#350D36','#1164A3','#FFFFFF','#350D36','#FFFFFF','#2BAC76','#CD2553'] },
  hoth:       { dark: false, colors: ['#F8F8FA','#F8F8FA','#2D9EE0','#FFFFFF','#FFFFFF','#383F45','#60D156','#DC5960'] },
  monument:   { dark: true,  colors: ['#0D7E83','#076570','#F79F66','#FFFFFF','#D37C71','#FFFFFF','#F79F66','#F15340'] },
  chocoMint:  { dark: true,  colors: ['#544538','#42362B','#5DB09D','#FFFFFF','#4A3C30','#FFFFFF','#FFFFFF','#5DB09D'] },
  ochin:      { dark: true,  colors: ['#303E4D','#2C3849','#6698C8','#FFFFFF','#4A5664','#FFFFFF','#94E864','#78AF8F'] },
  workHard:   { dark: true,  colors: ['#4D5250','#444A47','#D39B46','#FFFFFF','#434745','#FFFFFF','#99D04A','#DB6668'] },
  // community/legacy (see §3) — optional extras
  slackWhite: { dark: false, colors: ['#FFFFFF','#FFFFFF','#FFFFFF','#2288CC','#2288CC','#454449','#93CC93','#2288CC'] },
};

/** Apply a theme by writing the 8 slots as CSS variables on a root element. */
function applySlackTheme(name, root = document.documentElement) {
  const theme = SLACK_THEMES[name];
  if (!theme) return;
  theme.colors.forEach((hex, i) => root.style.setProperty(SLACK_SLOTS[i], hex));
  root.setAttribute('data-slackify-theme', theme.dark ? 'dark' : 'light');
}
```

> Pair `applySlackTheme` with the attribute-gated toggle pattern in
> [`EXTENSION-BEST-PRACTICES.md`](EXTENSION-BEST-PRACTICES.md) §5: it sets
> `data-slackify-theme="dark|light"` so the stylesheet can additionally adjust the
> message-area / top-bar contrast (slots 1–8 cover the *sidebar* only; Chat's main pane
> and top bar need their own derived values).

---

## 7. Sources & confidence summary

| Data | Source | Confidence |
| --- | --- | --- |
| 8-slot ordering & meanings | [Suptask](https://www.suptask.com/blog/best-slack-themes), [slack-themes.vercel.app](https://slack-themes.vercel.app/create-a-theme), [Gadget Hacks](https://smartphones.gadgethacks.com/how-to/change-slacks-sidebar-theme-your-iphone-android-phone-for-customized-colors-0194708/) | High (multiple agreeing sources) |
| Preset *names* set | [G2](https://learn.g2crowd.com/slack-themes), [Suptask](https://www.suptask.com/blog/best-slack-themes), [Slack help](https://slack.com/help/articles/205166337-Change-your-Slack-theme) | High |
| Aubergine hex (`#3F0E40`) | [`paracycle/slackthemes`](https://github.com/paracycle/slackthemes/blob/master/data/themes.yml) + matches current Slack & this repo | High |
| Other preset hex strings | [`paracycle/slackthemes`](https://github.com/paracycle/slackthemes/blob/master/data/themes.yml), cross-checked vs [`sachinh19/slack-themes`](https://github.com/sachinh19/slack-themes) | Medium-high (community-verified, not first-party) |
| Community/legacy palettes (§3) | [`paracycle/slackthemes`](https://github.com/paracycle/slackthemes/blob/master/data/themes.yml) | Medium-high (hex stable across mirrors) |
| 2022 redesign presets (Banana, etc.) | [Slack Design article](https://slack.design/articles/a-new-visual-language-for-slack/) | Names only — **hex unverified** |

---

## 8. Mode-reactive palettes — **sampled 2026-06-27**

As §4 advised, the 2022 presets were **sampled live** from the Slack desktop client (8 screenshots
of Preferences → Appearance, each theme shown in **both Light and Dark**), using a pixel reader on
the rendered sidebar background + active item. This is what `src/themes.js` now uses.

**The model changed:** one Slack theme renders very differently per appearance mode — Light shows
the saturated brand color on the sidebar; Dark collapses it to a very dark tint of the same hue
(the color survives mainly in the active item / accents). Google Chat has a single sidebar surface
(no separate workspace rail), so each theme defines an explicit **per-mode** palette and
`styles.js` emits the CSS variables under `html[data-sf-theme="…"][data-sf-mode="…"]`.

Sidebar bg + active item, sampled (✓) or derived from a sampled swatch identity (≈):

| Theme | Light bg | Light active | Dark bg | Dark active | Source |
| --- | --- | --- | --- | --- | --- |
| **Aubergine** | `#611F69` | `#7A3382` | `#241229` | `#7D3986` | ✓ sampled both modes |
| **Jade** | `#178F65` | `#0E674D` | `#0D241E` | `#106F4D` | ✓ sampled both modes |
| **Gray** | `#F8F8FA` | `#363636` | `#17191C` | `#414549` | ✓ sampled both modes |
| **Tritanopia** | `#FFFFFF` | `#0F1012` | `#0F1012` | `#2C2D31` | ✓ sampled (high-contrast) |
| **Lagoon** | `#006EA2` | ≈ | `≈ mixB .80` | ≈ | ≈ identity `#006EA2` sampled from picker swatch |
| **Clementine** | `#DB4E03` | ≈ | `≈ mixB .80` | ≈ | ≈ identity `#DB4E03` |
| **Banana** | `#FFD737` | ≈ | `≈ mixB .80` | ≈ | ≈ identity `#FFD737` (light → dark text) |
| **Barbra** | `#FF81AB` | ≈ | `≈ mixB .80` | ≈ | ≈ identity `#FF81AB` |
| **Mood Indigo** | `#132785` | ≈ | `≈ mixB .80` | ≈ | ≈ identity `#132785` |

> "≈" rows: only the **identity** hex is sampled (from Slack's own picker swatch). The per-mode
> shades are then **computed** deterministically in `themes.js` (mix toward white/black), never
> hand-guessed. Text color is chosen by luminance so it stays readable on any bg.
