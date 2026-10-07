const CONNECTORS={
  federal:{label:'Federal RFB/PGFN',portal:'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir',env:['SERPRO_CND_CLIENT_ID','SERPRO_CND_CLIENT_SECRET']},
  fgts:{label:'FGTS CRF Caixa',portal:'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf'},
  cndt:{label:'CNDT',portal:'https://cndt-certidao.tst.jus.br/inicio.faces'},
  estadual:{label:'Estadual SP',portal:'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf'},
  municipal:{label:'Municipal Santos',portal:'https://egov.santos.sp.gov.br/tribusweb/CertidaoGeral/Certidao'}
};
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const type=String(req.query?.type||'').toLowerCase();
  const cnpj=String(req.query?.cnpj||'').replace(/\D/g,'');
  const cfg=CONNECTORS[type];
  if(!cfg)return res.status(400).json({status:'error',message:'Tipo de certidão inválido.'});
  if(cnpj.length!==14)return res.status(400).json({status:'error',message:'CNPJ inválido.'});
  if(type==='federal'){
    const configured=cfg.env.every(k=>Boolean(process.env[k]));
    if(!configured)return res.status(200).json({status:'requires_configuration',source:'SERPRO CND',portal:cfg.portal,message:'Conector Federal preparado. Para consulta automática é necessário configurar as credenciais oficiais do serviço Consulta CND do SERPRO.'});
    return res.status(200).json({status:'requires_configuration',source:'SERPRO CND',portal:cfg.portal,message:'Credenciais detectadas. A chamada transacional será habilitada após validação do contrato/plano e do endpoint autorizado pelo SERPRO.'});
  }
  const messages={
    fgts:'Consulta assistida do CRF/FGTS: o portal oficial será aberto. O ATLAS controla validade e histórico após o registro.',
    cndt:'Consulta assistida da CNDT: o portal oficial será aberto porque o fluxo pode exigir validação humana.',
    estadual:'Consulta assistida estadual: o portal oficial será aberto. O conector será adaptado ao novo fluxo estadual quando a integração estiver disponível.',
    municipal:'Consulta assistida municipal: o portal oficial será aberto porque o fluxo pode exigir código de verificação.'
  };
  return res.status(200).json({status:'assisted',source:cfg.label,portal:cfg.portal,message:messages[type]});
};
