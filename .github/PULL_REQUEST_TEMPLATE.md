<!-- Thanks for contributing! Please confirm the checklist below. -->

## What does this PR do?



## Checklist

- [ ] No hashed/auto-generated class selectors — durable hooks or `data-slackify` tags only
- [ ] New/changed selectors live in `src/config.js` with a locale-independent fallback
- [ ] No new permissions, no network calls, no remote code (`eval`/`new Function`)
- [ ] Cosmetic only — Google Chat functionality is unaffected; DOM work is `try/catch`-wrapped
- [ ] Ran `tools/health-check.js` (all critical selectors OK) and the `tools/SMOKE-TEST.md` checklist
- [ ] Tested at least one dark and one light theme
- [ ] New feature added to `FEATURES` (config), gated in `styles.js`, visible in popup
- [ ] New theme uses verified hex (`docs/SLACK-THEMES.md`)
- [ ] Bumped `manifest.json` version and updated `CHANGELOG.md`

## Screenshots (before / after)


