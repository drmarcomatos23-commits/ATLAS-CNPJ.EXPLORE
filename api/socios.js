const digits = value => String(value || '').replace(/\D/g, '');
const json = (res,status,body) => {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.end(JSON.stringify(body));
};
export default async function handler(req,res) {
  if(req.method!=='POST')return json(res,405,{titulo:'Método não permitido'});
  const token=process.env.CNPJWS_API_TOKEN;
  if(!token)return json(res,503,{titulo:'Pesquisa automática indisponível',detalhes:'Para buscar empresas diretamente pelo nome ou CPF do sócio, configure CNPJWS_API_TOKEN na Vercel (plano Premium). Alternativamente, informe CNPJs para verificação no Atlas.'});
  const name=String(req.body?.nome || '').trim().replace(/\s+/g,' ').slice(0,160);
  const cpf=digits(req.body?.cpf).slice(0,11);
  if(name.length<3 || (cpf && cpf.length!==11))return json(res,400,{titulo:'Dados inválidos',detalhes:'Informe nome completo e CPF válido, quando utilizado.'});
  try {
    const url=new URL('https://comercial.cnpj.ws/v2/pesquisa');
    url.searchParams.set('socio_nome',name);
    if(cpf)url.searchParams.set('socio_cpf_cnpj',cpf);
    url.searchParams.set('limite','10');
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),15000);
    let response;
    try {response=await fetch(url,{headers:{x_api_token:token,Accept:'application/json'},signal:abort.signal});}
    finally {clearTimeout(timeout);}
    const payload=await response.json().catch(()=>null);
    if(!response.ok)return json(res,response.status===429?429:502,{titulo:'Falha na pesquisa societária',detalhes:response.status===401||response.status===403?'Credencial CNPJws inválida ou plano sem acesso à pesquisa.':response.status===429?'Limite da API atingido. Tente novamente mais tarde.':'O provedor não concluiu a consulta.'});
    const list=Array.isArray(payload?.data)?payload.data:[];
    const cnpjs=[...new Set(list.map(item=>digits(typeof item==='string'?item:(item?.cnpj||item?.estabelecimento?.cnpj))).filter(c=>c.length===14))];
    // The search endpoint returns identifiers only. Resolve the legal name without
    // loading the full company dashboard or performing a second QSA verification.
    const empresas=await Promise.all(cnpjs.map(async cnpj => {
      try {
        const signal=AbortSignal.timeout(12000);
        const companyResponse=await fetch('https://comercial.cnpj.ws/cnpj/'+cnpj,{
          headers:{x_api_token:token,Accept:'application/json'},signal
        });
        if(!companyResponse.ok)return {cnpj,razao_social:null};
        const company=await companyResponse.json();
        return {cnpj,razao_social:typeof company?.razao_social==='string'?company.razao_social:null};
      }catch{return {cnpj,razao_social:null};}
    }));
    return json(res,200,{empresas,total:payload?.paginacao?.total??null,tem_proxima_pagina:Boolean(payload?.paginacao?.tem_proxima_pagina),fonte:'CNPJws comercial',aviso:'Lista indicativa sujeita à atualização; identidade e vínculos devem ser conferidos em documentos oficiais.'});
  }catch {return json(res,502,{titulo:'Pesquisa indisponível',detalhes:'Não foi possível conectar à API comercial. Tente novamente.'});}
}
