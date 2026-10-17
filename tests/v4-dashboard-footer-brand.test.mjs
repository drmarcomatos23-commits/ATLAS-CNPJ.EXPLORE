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
  const head = { appendChild(){} };
  const body = {};
  const document = {
    head,
    body,
    querySelector(selector){
      if(selector === '[data-page="dashboard"].active') return dashboardActive ? {} : null;
      if(selector === '.brand-logo') return img;
      if(selector === '.sidebar-footer span:first-of-type') return subtitle;
      if(selector.startsWith('link[data-atlas-') || selector.startsWith('script[data-atlas-')) return {};
      return null;
    },
    querySelectorAll(){ return []; },
    createElement(){ return { dataset:{}, addEventListener(){}, set rel(v){this._rel=v}, set href(v){this._href=v}, set src(v){this._src=v} }; },
    addEventListener(type, cb){ handlers[type]=cb; }
  };
  class MutationObserver { constructor(cb){ this.cb=cb; } observe(){} }
  const window = { matchMedia:()=>({matches:false}), addEventListener(){}, emitAtlasReportV4:true };
  const context = { document, window, MutationObserver, queueMicrotask: (fn)=>fn() };
  vm.runInNewContext(fs.readFileSync('dashboard-brand-guard-v4.js','utf8'), context);
  handlers.DOMContentLoaded();
  assert.equal(img.src, '/atlas-dashboard-brand.svg?v=4.2');
  assert.equal(subtitle.hidden, true, 'subtitulo inferior deve ficar oculto na Dashboard');

  dashboardActive = false;
  handlers.click({target:{closest:()=>({})}});
  assert.equal(subtitle.hidden, false, 'fora da Dashboard o subtitulo pode reaparecer');
});
