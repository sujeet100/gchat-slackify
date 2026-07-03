/*
 * slackify.d.ts — ambient types for the cross-file SLACKIFY_* globals.
 *
 * Each src/*.js file is an IIFE that assigns to globalThis (the project's deliberately build-free
 * "module system"). Declaring those globals here lets `// @ts-check` verify usage ACROSS files —
 * e.g. a typo'd `C.firstMatchEll(...)` or a wrong arg count becomes a compile-time error, with no
 * bundler and no change to the shipped JS.
 */

/** A user-defined color theme (the three anchor colors; the rest is derived — see themes.js). */
interface SfCustomThemeDef {
  id: string;      // OURS, CSS-selector-safe (`cst-<n>`); used as the `data-sf-theme` value
  label: string;   // display-only name shown in the theme dropdown
  sidebar: string; // sidebar background (#RRGGBB)
  accent: string;  // active-item / brand color (#RRGGBB)
  topbar: string;  // top-bar background (#RRGGBB)
}

/** A user preference set (persisted under `chrome.storage.sync` key "prefs"). */
interface SfPrefs {
  enabled: boolean;
  theme: string;
  mode?: 'light' | 'dark';
  features: Record<string, boolean>;
  customThemes?: SfCustomThemeDef[];
}

/** An independently toggleable feature (drives `html[data-sf-feat-<id>]` + the popup). */
interface SfFeature {
  id: string;
  group: string;   // popup section id — one of FEATURE_GROUPS
  label: string;
  default: boolean;
  desc: string;
}

/** A popup section grouping related features (display order = array order). */
interface SfFeatureGroup {
  id: string;
  label: string;
}

/** config.js — the single source of truth for selectors, features, defaults, and helpers. */
interface SfConfig {
  SELECTORS: Record<string, string[]>;
  TAGS: Record<string, string>;
  FEATURES: SfFeature[];
  FEATURE_GROUPS: SfFeatureGroup[];
  DEFAULT_PREFS: SfPrefs;
  CUSTOM_THEME_DEFAULTS: { sidebar: string; accent: string; topbar: string };
  newCustomTheme(existing?: SfCustomThemeDef[]): SfCustomThemeDef;
  sel(key: string): string;
  firstMatchEl(key: string, root?: ParentNode): Element | null;
  allMatchEls(key: string, root?: ParentNode): Element[];
}

/** A theme palette for one appearance mode (sidebar + top bar colors). */
interface SfThemeMode {
  bg: string;
  active: string;
  text: string;
  activeText: string;
  presence: string;
  mention: string;
  hoverOverlay: string;
  topBg: string;
  topText: string;
}

/** A Slack theme with an explicit palette per light/dark mode. */
interface SfTheme {
  id: string;
  label: string;
  isDark: boolean;
  modes: { light: SfThemeMode; dark: SfThemeMode };
}

/** themes.js — theme palettes + message-area mode accents. */
interface SfThemes {
  THEMES: SfTheme[];
  MODES: Record<'light' | 'dark', Record<string, string>>;
  /** Derive a full mode-reactive theme from a user's three anchor colors. */
  buildCustomTheme(def: SfCustomThemeDef): SfTheme;
  /** Render a theme's sidebar/top-bar CSS-var block for both modes (shared by styles.js + apply.js). */
  themeVarsCSS(theme: SfTheme): string;
}

/** styles.js — compiles the whole stylesheet from config + themes. */
interface SfStyles {
  buildCSS(): string;
}

declare var SLACKIFY_CONFIG: SfConfig;
declare var SLACKIFY_THEMES: SfThemes;
declare var SLACKIFY_STYLES: SfStyles;
