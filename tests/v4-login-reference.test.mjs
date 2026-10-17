import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('login reproduz a referencia aprovada sem depender de imagem quebravel',()=>{
  const shell=fs.readFileSync('atlas-sidebar-v4.css','utf8');
  const css=fs.readFileSync('login-reference-v4.css','utf8');
  assert.ok(shell.includes("@import url('/login-reference-v4.css?v=4.3')"));
  assert.match(css,/\.login-screen\s*\{[^}]*grid-template-columns:55% 45%/s);
  assert.match(css,/\.login-hero\s*\{[^}]*background:[^;]*#0b3156/s);
  assert.match(css,/\.login-panel\s*\{[^}]*background:#f7f9fc/s);
  assert.match(css,/\.login-card\s*\{[^}]*width:min\(520px,calc\(100% - 64px\)\)/s);
  assert.match(css,/\.login-card\s*\{[^}]*border-radius:24px/s);
  assert.match(css,/\.auth-main-btn\s*\{[^}]*#064775/s);
  assert.match(css,/\.login-logo\s*\{[^}]*content:url\("data:image\/svg\+xml/s);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*?\.login-screen\s*\{[^}]*grid-template-columns:1fr/s);
  assert.match(css,/\.login-screen:not\(\.hidden\)\s*~\s*\.app-shell\s*\{[^}]*display:none!important/s);
});
