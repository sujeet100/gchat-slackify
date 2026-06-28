#!/usr/bin/env node
/*
 * validate-manifest.js — CI gate that encodes the non-negotiable CLAUDE.md rules as hard checks,
 * so a PR that violates the security/privacy contract FAILS instead of relying on human review:
 *
 *   - Rule #4  "No new permissions."        → permissions ⊆ ALLOWED_PERMISSIONS; no host_permissions.
 *   - Rule #5  "No network, ever."          → no fetch/XHR/WebSocket/beacon/eval/remote-code in src.
 *   - Scope    runs only on Google Chat.    → every content-script match is a Chat/Gmail-Chat URL.
 *   - Hygiene  version consistency.         → manifest.json version === package.json version.
 *
 * Pure Node built-ins, no dependencies. Run via `npm run validate` (also wired into CI).
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));

const ALLOWED_PERMISSIONS = ['storage'];
const ALLOWED_MATCH = /^https:\/\/(chat\.google\.com|mail\.google\.com)\//;
// Network / remote-code sinks that must never appear in shipped extension code (call/keyword syntax,
// so plain prose mentions in comments don't trip it).
const FORBIDDEN = [
  { re: /\bfetch\s*\(/, name: 'fetch()' },
  { re: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
  { re: /\bWebSocket\b/, name: 'WebSocket' },
  { re: /\bsendBeacon\s*\(/, name: 'navigator.sendBeacon()' },
  { re: /\beval\s*\(/, name: 'eval()' },
  { re: /\bnew\s+Function\s*\(/, name: 'new Function()' },
  { re: /\bimportScripts\s*\(/, name: 'importScripts()' },
];
// innerHTML is allowed ONLY to clear (= '' / "" / ``); any other assignment is an XSS sink.
const INNER_HTML = /\.innerHTML\s*=\s*([^;\n]*)/g;
const isEmptyStringLiteral = (v) => /^(''|""|``)$/.test(v.trim());

const SCAN_DIRS = ['src', 'popup'];

const errors = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { errors.push(m); console.log(`  ✗ ${m}`); };

// strip block + line comments so prose mentions of sinks don't cause false positives
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
function listJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJs(rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

console.log('Permissions:');
const perms = manifest.permissions || [];
const extra = perms.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
if (extra.length) fail(`unexpected permission(s): ${extra.join(', ')} (allowed: ${ALLOWED_PERMISSIONS.join(', ')})`);
else pass(`permissions = [${perms.join(', ')}]`);
for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions']) {
  if (manifest[key]) fail(`manifest declares "${key}" — not allowed (rule #4)`);
}
if (!manifest.host_permissions) pass('no host_permissions');

console.log('Content-script scope:');
for (const cs of manifest.content_scripts || []) {
  for (const m of cs.matches || []) {
    if (ALLOWED_MATCH.test(m)) pass(`match ${m}`);
    else fail(`content_script match out of scope: ${m}`);
  }
}

console.log('Version consistency:');
if (manifest.version === pkg.version) pass(`manifest.json and package.json both at ${pkg.version}`);
else fail(`version drift: manifest.json=${manifest.version} vs package.json=${pkg.version}`);

console.log('No network / remote-code sinks in source:');
let sinkHits = 0;
for (const file of SCAN_DIRS.flatMap(listJs)) {
  const code = stripComments(read(file));
  for (const { re, name } of FORBIDDEN) {
    if (re.test(code)) { fail(`${file} contains forbidden sink: ${name}`); sinkHits++; }
  }
  let m;
  while ((m = INNER_HTML.exec(code))) {
    if (!isEmptyStringLiteral(m[1])) { fail(`${file} assigns a non-empty innerHTML (XSS sink): ${m[0].trim()}`); sinkHits++; }
  }
}
if (!sinkHits) pass('no fetch/XHR/WebSocket/beacon/eval/remote-code/innerHTML sinks found');

console.log('');
if (errors.length) {
  console.error(`❌ validate-manifest: ${errors.length} violation(s) of the CLAUDE.md contract.`);
  process.exit(1);
}
console.log('✅ validate-manifest: extension contract holds (permissions, scope, version, no network).');
