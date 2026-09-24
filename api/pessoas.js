// Pesquisa indicativa em fonte histórica, sem consulta cadastral automática.
const DATASET_DATE='2020-09-20';
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const digits=value=>String(value??'').replace(/\D/g,'');
const respond=(res,status,body)=>{res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);};
function cpfValid(value){
 if(!/^\d{11}$/.test(value)||/^(\d)\1{10}$/.test(value))return false;
 const digit=n=>{const sum=[...value.slice(0,n)].reduce((acc,ch,i)=>acc+Number(ch)*(n+1-i),0);return (sum*10%11)%10;};
 return digit(9)===Number(value[9])&&digit(10)===Number(value[10]);
}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return respond(res,405,{titulo:'Método não permitido'});}
 const name=String(req.body?.nome??'').replace(/\s+/g,' ').trim();
 const cpf=digits(req.body?.cpf);
 if(name.length<5||name.length>160||cpf&&(cpf.length!==11||!cpfValid(cpf)))return respond(res,400,{titulo:'Dados inválidos',detalhes:'Informe nome completo e, se utilizado, CPF válido.'});
 const token=process.env.BRASIL_IO_API_TOKEN;
 if(!token)return respond(res,503,{titulo:'Fonte histórica não configurada',detalhes:'A pesquisa no Brasil.IO depende de token do próprio serviço. Configure BRASIL_IO_API_TOKEN no ambiente da Vercel. A consulta cadastral por CNPJ continua disponível.'});
 const query=new URL('https://api.brasil.io/v1/dataset/socios-brasil/socios/data/');
 query.searchParams.set('nome_socio',name);
 query.searchParams.set('page_size','50');
 query.searchParams.set('page','1');
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const upstream=await fetch(query,{signal:controller.signal,headers:{Authorization:'Token '+token,Accept:'application/json'}});
  if(!upstream.ok)return respond(res,upstream.status===429?429:502,{titulo:'Fonte de pesquisa indisponível',detalhes:upstream.status===401||upstream.status===403?'Token do Brasil.IO não autorizado.':upstream.status===429?'Limite do provedor atingido.':'Não foi possível consultar o Brasil.IO.'});
  const raw=await upstream.text();
  if(raw.length>1024*1024)return respond(res,502,{titulo:'Resposta excedeu o limite'});
  const payload=JSON.parse(raw);
  if(!Array.isArray(payload?.results))return respond(res,502,{titulo:'Formato da fonte inesperado'});
  const expected=normalize(name);
  const masked=cpf?'***'+cpf.slice(3,9)+'**':null;
  const found=new Map();
  for(const row of payload.results){
   if(normalize(row.nome_socio)!==expected)continue;
   const personDoc=String(row.cpf_cnpj_socio??'');
   if(cpf&&personDoc!==masked)continue;
   const cnpj=digits(row.cnpj);
   if(cnpj.length!==14||!row.razao_social)continue;
   if(!found.has(cnpj))found.set(cnpj,{cnpj,razao_social:String(row.razao_social).slice(0,255),qualificacao:String(row.qualificacao_socio??'').slice(0,100)});
  }
  const empresas=[...found.values()];
  return respond(res,200,{empresas,fonte:'Brasil.IO · Sócios das Empresas Brasileiras',data_base:DATASET_DATE,consulta_completa:!payload.next,total_fonte:payload.count??null,proxima_pagina:Boolean(payload.next),cpf_conferido:!!cpf,ressalva:'Dados históricos de 20/09/2020. Correspondência por nome e CPF mascarado não comprova vínculo atual ou identidade. Resultados podem ser parciais.'});
 }catch(error){
  return respond(res,502,{titulo:'Pesquisa temporariamente indisponível',detalhes:error?.name==='AbortError'?'A fonte ultrapassou o prazo de resposta.':'Não foi possível recuperar os dados históricos.'});
 }finally{clearTimeout(timeout);}
}
