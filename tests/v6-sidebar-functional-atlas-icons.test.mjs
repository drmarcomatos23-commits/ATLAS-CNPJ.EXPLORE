import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('atlas-v6-shell.js','utf8');
const css = fs.readFileSync('mockup-fidelity-v6.css','utf8');

test('sidebar uses inline outline SVG icons instead of text glyphs',()=>{
  assert.match(shell,/const iconSvgByPage/);
  assert.match(shell,/viewBox="0 0 24 24"/);
  assert.match(shell,/stroke="currentColor"/);
  assert.doesNotMatch(shell,/dashboard:\s*'⌂'/);
  assert.doesNotMatch(shell,/custos:\s*'\$'/);
});

test('sidebar follows functional Atlas navigation group labels',()=>{
  for (const label of ['Visão Geral','Operação','Gestão','ATLAS','Administração']) {
    assert.ok(shell.includes(label), `missing ${label}`);
  }
});

test('sidebar icon sizing is compact like functional Atlas',()=>{
  assert.match(css,/\.nav-ico svg\{width:20px!important;height:20px!important/);
});
