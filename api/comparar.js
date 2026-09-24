const SOURCES = {
  brasilapi: { label: 'BrasilAPI', base: 'https://brasilapi.com.br/api/cnpj/v1/' },
  opencnpj: { label: 'OpenCNPJ', base: 'https://api.opencnpj.org/' }
};
function validCnpj(value) {
  if(!/^\d{14}$/.test(value)||/^(\d)\1{13}$/.test(value))return false;
  const calc=(base,w)=>{const n=[...base].reduce((sum,c,i)=>sum+Number(c)*w[i],0);return n%11<2?0:11-n%11;};
  return value.endsWith(String(calc(value.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2]))+String(calc(value.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])));
}
const text=v=>typeof v==='string'||typeof v==='number'?String(v).trim():null;
const description=v=>text(v?.descricao)||text(v);
function normalize(payload,source,requested) {
  const establishment=payload?.estabelecimento||{};
  const cnpj=String(payload?.cnpj||establishment?.cnpj||'').replace(/\D/g,'');
  if(cnpj!==requested)throw new Error('A fonte retornou um CNPJ diferente.');
  const status=description(payload?.descricao_situacao_cadastral)||description(payload?.situacao_cadastral)||description(establishment?.situacao_cadastral);
  const cnae=payload?.cnae_fiscal||payload?.cnae_principal||payload?.atividade_principal?.id||establishment?.atividade_principal?.id;
  return {
    fonte:source,
    cnpj,
    razao_social:text(payload?.razao_social)||text(payload?.nome_empresarial),
    nome_fantasia:text(payload?.nome_fantasia)||text(establishment?.nome_fantasia),
    situacao_cadastral:status,
    capital_social:text(payload?.capital_social),
    cnae_principal:text(cnae),
    municipio:text(payload?.municipio)||text(payload?.cidade)||text(establishment?.cidade?.nome),
    uf:text(payload?.uf)||text(payload?.estado?.sigla)||text(establishment?.estado?.sigla),
    atualizado_em:text(payload?.atualizado_em)||text(payload?.data_atualizacao)||null
  };
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({titulo:'Método não permitido'});
  const cnpj=String(req.query?.cnpj||'').replace(/\D/g,'');
  if(!validCnpj(cnpj))return res.status(400).json({titulo:'CNPJ inválido'});
  const source=req.query?.fonte;
  if(!Object.hasOwn(SOURCES,source))return res.status(400).json({titulo:'Fonte inválida'});
  const provider=SOURCES[source];
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(provider.base+cnpj,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)return res.status(response.status===429?429:502).json({titulo:provider.label+' indisponível',detalhes:response.status===429?'Limite de consultas do provedor atingido.':'Não foi possível obter o cadastro nessa fonte.'});
    const raw=await response.text();
    if(raw.length>2*1024*1024)throw new Error('Resposta excede o limite de tamanho.');
    const payload=JSON.parse(raw);
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Formato inesperado.');
    const data=normalize(payload,provider.label,cnpj);
    return res.status(200).json(data);
  } catch(error) {
    return res.status(502).json({titulo:'Falha na fonte '+provider.label,detalhes:error?.name==='AbortError'?'A consulta excedeu 12 segundos.':'A fonte não forneceu dados válidos para comparação.'});
  } finally {clearTimeout(timeout);}
}
