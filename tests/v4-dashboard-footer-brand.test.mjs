import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Dashboard oculta somente o subtitulo inferior e mantem o logo', () => {
  let dashboardActive = true;
  const img = {
    src: '/atlas-sidebar-brand.svg?v=4.4',
    getAttribute(name){ return name === 'src' ? this.src : null; },
    setAttribute(name,value){ if(name === 'src') this.src=value; }
  };
  const subtitle = { hidden: false };
  const handlers = {};
  const document = {
    querySelector(selector){
      if(selector === '[data-page="dashboard"].active') return dashboardActive ? {} : null;
      if(selector === '.brand-logo') return img;
      if(selector === '.sidebar-footer span:first-of-type') return subtitle;
      return null;
    },
    addEventListener(type, cb){ handlers[type]=cb; }
  };
  class MutationObserver { constructor(cb){ this.cb=cb; } observe(){} }
  const context = { document, MutationObserver, queueMicrotask: (fn)=>fn() };
  vm.runInNewContext(fs.readFileSync('dashboard-brand-guard-v4.js','utf8'), context);
  handlers.DOMContentLoaded();
  assert.equal(img.src, '/atlas-dashboard-brand.svg?v=4.2');
  assert.equal(subtitle.hidden, true, 'subtitulo inferior deve ficar oculto na Dashboard');

  dashboardActive = false;
  handlers.click({target:{closest:()=>({})}});
  assert.equal(subtitle.hidden, false, 'fora da Dashboard o subtitulo pode reaparecer');
});
