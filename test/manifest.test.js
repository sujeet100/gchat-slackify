/*
 * manifest.test.js — guards the packaged manifest's icon set. A blank toolbar icon (seen in
 * Vivaldi / HiDPI Chromium) is caused by a missing size or a mis-sized/corrupt PNG, so we assert
 * every declared icon exists on disk and is a PNG of exactly its declared pixel dimensions, and
 * that the 32px toolbar variant is present.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// Read a PNG's intrinsic size from its IHDR chunk (no deps): 8-byte signature, then a chunk whose
// data starts at byte 16 with width (uint32 BE) and height (uint32 BE).
function pngSize(file) {
  const b = fs.readFileSync(file);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(b.length > 24 && b.subarray(0, 8).equals(sig), `${file} is not a valid PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

for (const key of ['icons', 'action.default_icon']) {
  const set = key === 'icons' ? manifest.icons : manifest.action.default_icon;
  test(`${key}: every icon exists and is a PNG of its declared size`, () => {
    assert.ok(set && Object.keys(set).length, `${key} must declare icons`);
    for (const [size, rel] of Object.entries(set)) {
      const file = path.join(root, rel);
      assert.ok(fs.existsSync(file), `${rel} (declared ${size}px) is missing`);
      const { w, h } = pngSize(file);
      assert.strictEqual(w, Number(size), `${rel}: width ${w}px ≠ declared ${size}px`);
      assert.strictEqual(h, Number(size), `${rel}: height ${h}px ≠ declared ${size}px`);
    }
  });
}

test('toolbar icon set includes the 32px variant (HiDPI / Vivaldi blank-icon fix)', () => {
  assert.ok(manifest.icons['32'], 'icons.32 missing');
  assert.ok(manifest.action.default_icon['32'], 'action.default_icon.32 missing');
});
