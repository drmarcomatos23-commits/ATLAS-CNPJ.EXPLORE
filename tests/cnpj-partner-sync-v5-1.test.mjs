import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('cnpj-refresh-all-v4.js','utf8');

function loadApi(){
  const sandbox={
    window:{},
    document:{addEventListener(){}},
    queueMicrotask(fn){fn()},
    console,
    Date,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:'cnpj-refresh-all-v4.js'});
  return sandbox.window.AtlasCnpjRefreshAll;
}

function plain(value){return JSON.parse(JSON.stringify(value));}

test('atualização cadastral inclui capital social oficial sem tocar contatos',()=>{
  const api=loadApi();
  const patch=plain(api.officialCompanyPatch({
    razao_social:'Empresa Teste Ltda',
    capital_social:125000.50,
    estabelecimento:{nome_fantasia:'Empresa Teste',cidade:{nome:'Santos'},estado:{sigla:'SP'}}
  }));
  assert.equal(patch.capital_social,125000.50);
  assert.equal('phone' in patch,false);
  assert.equal('email' in patch,false);
});

test('normaliza QSA e ignora documento parcial como CPF/CNPJ confiável',()=>{
  const api=loadApi();
  assert.equal(typeof api.partnersFromPayload,'function');
  const partners=plain(api.partnersFromPayload({socios:[{
    nome:'Maria da Silva',
    cpf_cnpj_socio:'***123456**',
    qualificacao_socio:{descricao:'Sócio-Administrador'},
    data_entrada_sociedade:'2022-03-10',
    pais:{nome:'Brasil'}
  }]}));
  assert.equal(partners.length,1);
  assert.equal(partners[0].full_name,'Maria da Silva');
  assert.equal(partners[0].cpf,'');
  assert.equal(partners[0].nationality,'Brasileira');
  assert.equal(partners[0].is_administrator,true);
  assert.match(partners[0].notes,/Sócio-Administrador/);
});

test('conciliação societária preserva dados manuais e nunca exclui sócio existente',()=>{
  const api=loadApi();
  assert.equal(typeof api.mergePublicPartners,'function');
  const existing=[
    {id:'p1',full_name:'Maria da Silva',cpf:null,rg:'55.555.555-5',email:'maria@empresa.com',phone:'13999999999',profession:'Empresária',ownership_percentage:60,is_administrator:false,notes:'Observação manual'},
    {id:'p2',full_name:'João Antigo',cpf:'12345678901',rg:'44.444.444-4',email:'joao@empresa.com',is_administrator:true,notes:'Cadastro mantido'}
  ];
  const publicPartners=[
    {full_name:'MARIA DA SILVA',cpf:'98765432100',nationality:'Brasileira',is_administrator:true,notes:'Fonte pública: Sócio-Administrador'},
    {full_name:'Pedro Novo',cpf:'11122233344',nationality:'Brasileira',is_administrator:false,notes:'Fonte pública: Sócio'}
  ];
  const result=plain(api.mergePublicPartners(existing,publicPartners));
  assert.equal(result.rows.length,3);
  const maria=result.rows.find(x=>x.id==='p1');
  assert.equal(maria.rg,'55.555.555-5');
  assert.equal(maria.email,'maria@empresa.com');
  assert.equal(maria.phone,'13999999999');
  assert.equal(maria.profession,'Empresária');
  assert.equal(maria.ownership_percentage,60);
  assert.equal(maria.cpf,'98765432100');
  assert.equal(maria.is_administrator,true);
  assert.ok(result.rows.some(x=>x.id==='p2'));
  assert.ok(result.rows.some(x=>x.full_name==='Pedro Novo'));
  assert.equal(result.added,1);
  assert.equal(result.updated,1);
});
