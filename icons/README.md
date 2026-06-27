# Icons

`icon.svg` is the source. The Chrome Web Store requires raster PNGs (16, 48, 128).
The manifest intentionally does **not** reference icon files yet, so the extension
loads unpacked without them. Generate the PNGs and add the `icons` block before publishing.

## Generate PNGs (macOS)

With `rsvg-convert` (`brew install librsvg`):

```sh
for s in 16 48 128; do rsvg-convert -w $s -h $s icon.svg -o icon$s.png; done
```

Or with `sips` (built in; rasterizes from a 128 PNG):

```sh
rsvg-convert -w 128 -h 128 icon.svg -o icon128.png   # or any SVG->PNG tool
sips -z 48 48 icon128.png --out icon48.png
sips -z 16 16 icon128.png --out icon16.png
```

## Then add to manifest.json

```json
"icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
```
