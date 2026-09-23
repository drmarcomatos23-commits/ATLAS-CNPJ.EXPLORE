import { justDigits } from '../filiais.mjs';
/** A identificação automática requer token comercial da CNPJws, armazenado apenas na Vercel. */
export default async function handler(req,res) {
  if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({titulo:'Método não permitido'});}
  res.setHeader('Cache-Control','no-store');
  const raiz = justDigits(req.query?.raiz);
  const page = Number(req.query?.page || 1);
  if (!/^\d{8}$/.test(raiz) || !Number.isInteger(page) || page < 1 || page > 1000) return res.status(400).json({titulo:'Raiz ou página inválida'});
  const token = process.env.CNPJWS_TOKEN?.trim();
  if (!token) return res.status(501).json({titulo:'Consulta de filiais não configurada',detalhes:'A API pública consulta um CNPJ por vez. Para descobrir todos os estabelecimentos pela raiz, configure CNPJWS_TOKEN no ambiente da Vercel. Sem token, informe o CNPJ de uma filial conhecida para consultar individualmente.',codigo:'TOKEN_NAO_CONFIGURADO'});
  const abort = new AbortController();
  const timer = setTimeout(()=>abort.abort(),15000);
  try {
    const response = await fetch('https://comercial.cnpj.ws/cnpj-raiz/'+raiz+'?page='+page,{headers:{'x_api_token':token,'Accept':'application/json'},signal:abort.signal});
    const raw = await response.text();
    if (raw.length > 3000000) return res.status(502).json({titulo:'Resposta maior que o permitido'});
    let payload;try {payload=JSON.parse(raw);}catch {return res.status(502).json({titulo:'Resposta inválida da CNPJws'});}
    if(!response.ok) return res.status([401,403,404,429].includes(response.status)?response.status:502).json({titulo:'Falha na consulta de filiais',detalhes:typeof payload?.detalhes==='string'?payload.detalhes.slice(0,250):'Verifique o token e o limite do plano.'});
    if(!Array.isArray(payload?.data)) return res.status(502).json({titulo:'Formato inesperado da listagem'});
    const ids = payload.data.map(item=>justDigits(typeof item==='string'?item:item?.cnpj)).filter(cnpj=>/^\d{14}$/.test(cnpj)&&cnpj.startsWith(raiz));
    const p = payload.paginacao ?? {};
    res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=60');
    return res.status(200).json({raiz,cnpjs:[...new Set(ids)],pagina:page,paginas:Number(p.paginas)||1,total:Number.isInteger(Number(p.total))?Number(p.total):null,fonte:'CNPJws comercial'});
  } catch(error) {
    return res.status(502).json({titulo:'Erro na listagem de filiais',detalhes:error?.name==='AbortError'?'Tempo limite da CNPJws.':'Falha na comunicação com a CNPJws.'});
  } finally {clearTimeout(timer);}
}
