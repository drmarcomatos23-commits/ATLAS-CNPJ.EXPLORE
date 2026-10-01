const VIACEP_BASE='https://viacep.com.br/ws';
const BRASILAPI_BASE='https://brasilapi.com.br/api/cep/v2';

function onlyDigits(v){
  return String(v||'').replace(/\D/g,'');
}

async function fetchJson(url,timeoutMs=7000){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{
      signal:controller.signal,
      headers:{Accept:'application/json','User-Agent':'ATLAS-LEGALIZACAO/3.47'}
    });
    const text=await response.text();
    let body=null;
    try{body=JSON.parse(text)}catch{}
    if(!response.ok){
      const err=new Error(body?.message||body?.name||`HTTP ${response.status}`);
      err.status=response.status;
      throw err;
    }
    return body;
  }finally{
    clearTimeout(timeout);
  }
}

function normalizeViaCep(data,cep){
  if(!data||data.erro)return null;
  return {
    _atlas_source:'ViaCEP',
    cep:onlyDigits(data.cep||cep),
    street:data.logradouro||'',
    neighborhood:data.bairro||'',
    city:data.localidade||'',
    state:data.uf||'',
    complement:data.complemento||'',
    ibge:data.ibge||''
  };
}

function normalizeBrasilApi(data,cep){
  if(!data)return null;
  return {
    _atlas_source:'BrasilAPI (fallback)',
    cep:onlyDigits(data.cep||cep),
    street:data.street||'',
    neighborhood:data.neighborhood||'',
    city:data.city||'',
    state:data.state||'',
    complement:data.service||'',
    ibge:''
  };
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');

  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).json({message:'Método não permitido.'});
  }

  const cep=onlyDigits(req.query?.cep);
  if(cep.length!==8){
    return res.status(400).json({message:'CEP inválido. Informe 8 dígitos.'});
  }

  let lastError=null;

  try{
    const via=await fetchJson(`${VIACEP_BASE}/${encodeURIComponent(cep)}/json/`,6500);
    const normalized=normalizeViaCep(via,cep);
    if(normalized){
      if(req.method==='HEAD')return res.status(200).end();
      return res.status(200).json(normalized);
    }
    lastError=new Error('CEP não encontrado no ViaCEP.');
  }catch(err){
    lastError=err;
  }

  try{
    const br=await fetchJson(`${BRASILAPI_BASE}/${encodeURIComponent(cep)}`,6500);
    const normalized=normalizeBrasilApi(br,cep);
    if(normalized){
      if(req.method==='HEAD')return res.status(200).end();
      return res.status(200).json(normalized);
    }
  }catch(err){
    lastError=err;
  }

  const status=Number(lastError?.status)===404?404:502;
  return res.status(status).json({
    message:status===404?'CEP não encontrado.':'Não foi possível consultar o CEP agora. Tente novamente em instantes.'
  });
}
