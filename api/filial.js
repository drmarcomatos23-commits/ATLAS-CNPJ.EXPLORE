import { justDigits, validCnpj } from '../filiais.mjs';
/** Usa API comercial apenas quando existe token; caso contrário, consulta pontual gratuita. */
export default async function handler(req,res) {
  if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({titulo:'Método não permitido'});}
  const cnpj = justDigits(req.query?.cnpj);
  if (!validCnpj(cnpj)) return res.status(400).json({titulo:'CNPJ inválido'});
  const token = process.env.CNPJWS_TOKEN?.trim();
  const url = token ? 'https://comercial.cnpj.ws/cnpj/'+cnpj : 'https://publica.cnpj.ws/cnpj/'+cnpj;
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),18000);
  try {
    const response=await fetch(url,{headers:{'Accept':'application/json',...(token?{'x_api_token':token}:{})},signal:abort.signal});
    const raw=await response.text();
    if(raw.length>3_000_000)return res.status(502).json({titulo:'Resposta excessiva'});
    let body;try{body=JSON.parse(raw);}catch{return res.status(502).json({titulo:'Resposta inválida da CNPJws'});}
    if(!response.ok){res.setHeader('Cache-Control','no-store');return res.status([400,401,403,404,429].includes(response.status)?response.status:502).json({titulo:body?.titulo||'Falha ao consultar filial',detalhes:body?.detalhes||'Verifique o CNPJ e o limite de consultas.'});}
    if(body===null||typeof body!=='object'||Array.isArray(body)||!body.estabelecimento)return res.status(502).json({titulo:'Resposta cadastral incompleta'});
    res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=60');
    return res.status(200).json(body);
  }catch(err){return res.status(502).json({titulo:'Falha na consulta da filial',detalhes:err?.name==='AbortError'?'Tempo esgotado.':'Serviço externo indisponível.'});}
  finally{clearTimeout(timer);}
}
