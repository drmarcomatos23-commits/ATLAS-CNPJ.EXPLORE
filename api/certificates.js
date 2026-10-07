const CONNECTORS={
  federal:{label:'Federal RFB/PGFN',path:'/api/consultar-cnd-federal',portal:'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir'},
  fgts:{label:'FGTS CRF Caixa',path:'/api/consultar-crf-fgts',portal:'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'},
  cndt:{label:'CNDT',path:'/api/consultar-cndt',portal:'https://cndt-certidao.tst.jus.br/inicio.faces'},
  estadual:{label:'CND Estadual',path:'/api/consultar-cnd',portal:'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf'},
  municipal:{label:'Municipal Santos',portal:'https://egov.santos.sp.gov.br/tribusweb/CertidaoGeral/Certidao'}
};
const mapStatus=s=>{
  const v=String(s||'').toLowerCase();
  if(v==='negativa'||v==='positiva_com_efeitos_de_negativa')return'valid';
  if(v==='positiva')return'irregular';
  if(v==='erro')return'error';
  return'pending';
};
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const type=String(req.query?.type||'').toLowerCase();
  const cnpj=String(req.query?.cnpj||'').replace(/\D/g,'');
  const uf=String(req.query?.uf||'SP').toUpperCase();
  const cfg=CONNECTORS[type];
  if(!cfg)return res.status(400).json({status:'error',message:'Tipo de certidão inválido.'});
  if(cnpj.length!==14)return res.status(400).json({status:'error',message:'CNPJ inválido.'});
  if(type==='municipal')return res.status(200).json({status:'assisted',source:cfg.label,portal:cfg.portal,message:'Consulta municipal assistida: o portal de Santos pode exigir código de verificação/CAPTCHA. O ATLAS não contorna essa validação.'});
  const key=process.env.FISCALAPI_KEY;
  if(!key)return res.status(200).json({status:'requires_configuration',source:'FiscalAPI',portal:cfg.portal,message:'Integração automática preparada. Configure a chave FISCALAPI_KEY para ativar esta consulta.'});
  const params=new URLSearchParams({cnpj});
  if(type==='estadual')params.set('uf',uf);
  const url=`https://api.fiscalapi.com.br${cfg.path}?${params}`;
  try{
    const response=await fetch(url,{headers:{'X-API-Key':key,'Accept':'application/json'},signal:AbortSignal.timeout(70000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return res.status(200).json({status:'error',source:'FiscalAPI',portal:cfg.portal,message:data?.message||data?.error||`FiscalAPI HTTP ${response.status}`,provider_status:response.status});
    const source=data?.source_status||{};
    if(source.error_code==='EM_PROCESSAMENTO')return res.status(200).json({status:'processing',source:'FiscalAPI',message:source.error_message||'Certidão em processamento. Consulte novamente em instantes.',retry_after:Number(response.headers.get('retry-after')||30)});
    const result=data?.result;
    if(!result)return res.status(200).json({status:'error',source:'FiscalAPI',portal:cfg.portal,message:source.error_message||'A fonte não devolveu uma certidão.'});
    return res.status(200).json({status:'success',source:'FiscalAPI',certificate:{status:mapStatus(result.status),raw_status:result.status,raw_status_text:result.status_raw||'',issued_at:result.emissao_iso||result.emissao||null,expires_at:result.validade_iso||result.validade||null,certificate_number:result.protocolo||null,pdf_base64:result.pdf_base64||null,verification_url:result.url_verificacao||null,authority:result.orgao||cfg.label,mode:result.modo||null},provider:{request_id:data.request_id||null,cached:Boolean(data.cached)}});
  }catch(err){return res.status(200).json({status:'error',source:'FiscalAPI',portal:cfg.portal,message:`Falha ao consultar a FiscalAPI: ${err?.message||err}`});}
}
