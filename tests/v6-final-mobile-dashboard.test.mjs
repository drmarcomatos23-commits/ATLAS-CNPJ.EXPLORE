import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('atlas-reference-mobile.css','utf8');
const fixCss = fs.readFileSync('atlas-reference-mobile-fix.css','utf8');
const runtime = fs.readFileSync('atlas-reference-runtime.js','utf8');
const mobileRuntime = fs.readFileSync('mobile-responsive.js','utf8');
const mobileAppRuntime = fs.readFileSync('mobile-app-v4.js','utf8');

test('final mobile dashboard removes duplicate legacy header and dashboard FAB', () => {
  assert.match(css, /data-v6-page="dashboard"[^}]*page-head/s);
  assert.match(css, /#new-process-btn/);
  assert.match(css, /display:\s*none\s*!important/);
});

test('mobile drawer stays above its overlay and opens visibly', () => {
  assert.match(css, /\.sidebar\.mobile-open/);
  assert.match(css, /z-index:\s*2300/);
  assert.match(css, /mobile-nav-overlay[^}]*z-index:\s*2200/s);
  assert.match(css, /translateX\(0\)/);
});

test('final mobile reference and follow-up fix stylesheets are injected after desktop reference CSS', () => {
  assert.ok(runtime.includes('atlas-reference-mobile-css'));
  assert.ok(runtime.includes('/atlas-reference-mobile.css?v=1.0'));
  assert.ok(runtime.includes('atlas-reference-mobile-fix-css'));
  assert.ok(runtime.includes('/atlas-reference-mobile-fix.css?v=1.0'));
  assert.match(runtime, /ensureMobileStylesheet/);
  assert.match(runtime, /ensureMobileFixStylesheet/);
});

test('mobile final dashboard uses two KPI columns and natural page scroll', () => {
  assert.match(css, /atlas-kpi-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
});

test('final dashboard keeps the native mobile bottom navigation visible', () => {
  assert.match(mobileAppRuntime, /syncDashboardChrome/);
  assert.match(mobileAppRuntime, /bottom\.style\.setProperty\(['"]display['"],['"]grid['"],['"]important['"]\)/);
  assert.match(mobileAppRuntime, /workspace\.style\.setProperty\(['"]padding-bottom['"],['"]calc\(84px \+ env\(safe-area-inset-bottom\)\)['"],['"]important['"]\)/);
});

test('final dashboard topbar scrolls naturally instead of sticking under iOS browser chrome', () => {
  assert.match(mobileAppRuntime, /topbar\.style\.setProperty\(['"]position['"],['"]relative['"],['"]important['"]\)/);
  assert.match(mobileAppRuntime, /topbar\.style\.setProperty\(['"]top['"],['"]auto['"],['"]important['"]\)/);
});

test('phone landscape has an explicit final-dashboard layout instead of falling back to tablet desktop rules', () => {
  assert.match(fixCss, /orientation:\s*landscape/);
  assert.match(fixCss, /max-height:\s*520px/);
  assert.match(fixCss, /atlas-final-hero/);
  assert.match(fixCss, /atlas-kpi-grid[^}]*repeat\(3,minmax\(0,1fr\)\)/s);
});

test('opening the mobile drawer brings the active route into view and preserves scrollable navigation', () => {
  assert.match(mobileRuntime, /scrollActiveNavIntoView/);
  assert.match(mobileRuntime, /querySelector\(['"]\.nav-item\.active/);
  assert.match(mobileRuntime, /scrollIntoView/);
  assert.match(fixCss, /nav-list[^}]*overflow-y:\s*auto/s);
  assert.match(fixCss, /scroll-padding/);
});
