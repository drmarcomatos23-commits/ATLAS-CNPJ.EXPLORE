import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('mockup-fidelity-v6.css','utf8');

test('V6 sidebar navigation scrolls independently and smoothly',()=>{
  assert.match(css,/#app-shell \.nav-list[^}]*overflow-y:auto/s);
  assert.match(css,/#app-shell \.nav-list[^}]*overscroll-behavior:contain/s);
  assert.match(css,/#app-shell \.nav-list[^}]*scrollbar-gutter:stable/s);
  assert.match(css,/#app-shell \.nav-list::-webkit-scrollbar/s);
});

test('V6 sidebar keeps secondary navigation accessible instead of hover-clipped',()=>{
  assert.doesNotMatch(css,/#app-shell \.v6-secondary-nav\{[^}]*max-height:30px/s);
  assert.match(css,/#app-shell \.v6-secondary-nav[^}]*overflow:visible/s);
});

test('V6 sidebar footer remains fixed while only menu scrolls',()=>{
  assert.match(css,/#app-shell \.sidebar-footer[^}]*flex:0 0 auto/s);
  assert.match(css,/#app-shell \.nav-list[^}]*flex:1 1 0/s);
});
