# Icons

`icon.svg` is the source: a Slack-aubergine rounded square with a white channel-style `#`
(gradient `#6E2A74` → `#4A154B`). The rasterized PNGs are committed and **referenced by
`manifest.json`** (`icons` + `action.default_icon`):

- `icon-16.png`, `icon-48.png`, `icon-128.png`

## Regenerating the PNGs

The committed PNGs were rendered from `icon.svg` (128px master, downscaled for 48/16).

With `rsvg-convert` (`brew install librsvg`):

```sh
for s in 16 48 128; do rsvg-convert -w $s -h $s icon.svg -o icon-$s.png; done
```

Or with `sips` (built in; rasterize a 128 then downscale):

```sh
rsvg-convert -w 128 -h 128 icon.svg -o icon-128.png   # or any SVG->PNG tool
sips -z 48 48 icon-128.png --out icon-48.png
sips -z 16 16 icon-128.png --out icon-16.png
```

Keep the filenames (`icon-16/48/128.png`) so the `manifest.json` references stay valid.
