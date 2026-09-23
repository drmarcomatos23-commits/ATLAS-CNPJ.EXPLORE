import { validCnpj, justDigits } from '../filiais.mjs';
/** Fontes permitidas; endereço de destino nunca é fornecido pelo usuário. */
const PROVIDERS=Object.freeze({
 minhareceita:{label:'Minha Receita',base:'https://minhareceita.org/'},
 opencnpj:{label:'OpenCNPJ',base:'https://kitana.opencnpj.com/cnpj/'},
 viacep:{label:'ViaCEP',base:'https://viacep.com.br/ws/'},
 tcu:{label:'TCU — Consulta Consolidada',base:'https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/'}
});
const trim=(v,max=240)=>String(v??'').slice(0,max);
const text=v=>v===null||v===undefined?'':trim(v);
const err=(res,code,message)=>res.status(code).json({ok:false,erro:message});
export function normalizeProviderResponse(fonte,body,requested){
 if(fonte==='viacep'){
  if(body?.erro===true||!body?.cep)throw new Error('CEP não localizado na base ViaCEP.');
  return {cep:text(body.cep),logradouro:text(body.logradouro),bairro:text(body.bairro),municipio:text(body.localidade),uf:text(body.uf),ibge:text(body.ibge),fonte:'ViaCEP'};
 }
 if(fonte==='tcu'){
  if(!Array.isArray(body?.certidoes))throw new Error('A consulta consolidada retornou um formato inesperado.');
  return {cnpj:requested,razaoSocial:text(body.razaoSocial),certidoes:body.certidoes.slice(0,30).map(c=>({emissor:text(c.emissor),tipo:text(c.tipo),situacao:text(c.situacao),descricao:text(c.descricao),observacao:trim(c.observacao,500),emissao:text(c.dataHoraEmissao)})),fonte:'TCU — Consulta Consolidada'};
 }
 const d=fonte==='opencnpj'?body?.data:body;
 if(!d||typeof d!=='object'||Array.isArray(d)||justDigits(d.cnpj)!==requested)throw new Error('A fonte cadastral não retornou o CNPJ solicitado.');
 if(fonte==='minhareceita')return{cnpj:requested,razaoSocial:text(d.razao_social),nomeFantasia:text(d.nome_fantasia),situacao:text(d.descricao_situacao_cadastral),capitalSocial:d.capital_social??null,municipio:text(d.municipio),uf:text(d.uf),cep:text(d.cep),logradouro:text(d.logradouro),numero:text(d.numero),cnaePrincipal:text(d.cnae_fiscal),cnaeDescricao:text(d.cnae_fiscal_descricao),fonte:'Minha Receita'};
 return{cnpj:requested,razaoSocial:text(d.razaoSocial),nomeFantasia:text(d.nomeFantasia),situacao:text(d.situacaoCadastral),capitalSocial:d.capitalSocial??null,municipio:text(d.municipio),uf:text(d.uf),cep:text(d.cep),logradouro:text(d.logradouro),numero:text(d.numero),cnaePrincipal:'',cnaeDescricao:'',fonte:'OpenCNPJ'};
}
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return err(res,405,'Método não permitido.');}
 const fonte=String(req.query?.fonte??'');
 if(!Object.hasOwn(PROVIDERS,fonte))return err(res,400,'Fonte inválida.');
 const input=justDigits(fonte==='viacep'?req.query?.cep:req.query?.cnpj);
 if(fonte==='viacep'?!/^\d{8}$/.test(input):!validCnpj(input))return err(res,400,fonte==='viacep'?'CEP inválido.':'CNPJ inválido.');
 const url=PROVIDERS[fonte].base+input+(fonte==='viacep'?'/json/':fonte==='tcu'?'?seEmitirPDF=false':'');
 const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),9000);
 try{
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ATLAS-CNPJ-Explore/6.0'},signal:ac.signal});
  if(!r.ok){res.setHeader('Cache-Control','no-store');return err(res,r.status===429?429:502,r.status===429?'Limite da fonte atingido; aguarde antes de tentar novamente.':'Fonte '+PROVIDERS[fonte].label+' indisponível ('+r.status+').');}
  const payload=await r.text();if(payload.length>650000)return err(res,502,'Resposta excessiva da fonte.');
  let parsed;try{parsed=JSON.parse(payload);}catch{return err(res,502,'Resposta da fonte não está em JSON válido.');}
  let data;try{data=normalizeProviderResponse(fonte,parsed,input);}catch(e){return err(res,502,e.message);}
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=120');
  return res.status(200).json({ok:true,fonte:PROVIDERS[fonte].label,consultadoEm:new Date().toISOString(),dados:data});
 }catch(e){return err(res,502,e.name==='AbortError'?'A fonte demorou a responder; tente novamente.':'Não foi possível comunicar com a fonte.');}
 finally{clearTimeout(timer);}
}
