(() => {
 'use strict';
 const SERVICES=['legalizacao_empresarial','abertura','alteracao_societaria','regularizacao','licenciamento','baixa','encerramento'];
 const STATES=['not_requested','requested','received','in_review','approved','returned','waived'];
 const ORIGINS=['cliente','financeiro','orgao','operacao'];
 const DONE=new Set(['approved','waived']);
 const STARTERS={
  abertura:[
   ['Identificação e qualificação dos sócios e administradores','Dados dos participantes e representação.','required'],
   ['Documentos de identidade e CPF dos signatários','Conferir identificação conforme o caso.','required'],
   ['Endereço do estabelecimento e dados do imóvel','Comprovação conforme exigências locais.','conditional'],
   ['Dados para elaboração do ato constitutivo','Denominação, capital, quotas e administração.','required'],
   ['Atividades econômicas e CNAEs pretendidos','Principal e secundárias.','required'],
   ['Consulta de viabilidade do nome e do endereço','Quando exigida.','conditional'],
   ['Procuração e poderes de representação','Se o representante atuar por procuração.','conditional']
  ],
  alteracao_societaria:[
   ['Contrato social e alterações registradas','Versões vigentes e anteriores.','required'],
   ['Instrumento de alteração societária','Minuta das deliberações pertinentes.','required'],
   ['Identificação dos sócios e administradores envolvidos','Signatários e representantes.','conditional'],
   ['Informações sobre capital, quotas e administração','Conforme eventos a alterar.','conditional'],
   ['Viabilidade de nome, endereço ou atividade','Quando necessária.','conditional'],
   ['Documentação de entrada, retirada ou representação','Cessões e anuências aplicáveis.','conditional'],
   ['Dados para atualização cadastral na Redesim','Eventos correspondentes.','required']
  ],
  regularizacao:[
   ['CNPJ e atos empresariais vigentes','Identificação e poderes.','required'],
   ['Intimação, exigência, auto ou apontamento da irregularidade','Documento de origem da pendência.','required'],
   ['Protocolos e comprovantes anteriores','Histórico administrativo.','conditional'],
   ['Comprovantes fiscais, declarações ou pagamentos','Quando pertinentes.','conditional'],
   ['Documentos do imóvel, atividade ou responsáveis','Conforme órgão competente.','conditional'],
   ['Procuração e autorização de representação','Se houver procurador.','conditional']
  ],
  licenciamento:[
   ['CNPJ e ato constitutivo vigente','Atividade e identificação.','required'],
   ['Endereço e documentos do imóvel','Imóvel e inscrição pertinente.','conditional'],
   ['Atividades e CNAEs exercidos no local','Descrição, ocupação e risco.','required'],
   ['Viabilidade ou consulta de uso do solo','Quando exigida pelo município.','conditional'],
   ['Plantas, laudos e responsabilidade técnica','ART/RRT conforme licença.','conditional'],
   ['Autorizações específicas e licenças anteriores','Vigilância, bombeiros, ambiente etc.','conditional']
  ],
  baixa:[
   ['CNPJ e atos constitutivos atualizados','Último registro.','required'],
   ['Distrato social ou ato de extinção','Conforme natureza jurídica.','required'],
   ['Identificação e poderes dos signatários','Representação e procuração.','required'],
   ['Dados para baixa cadastral na Redesim','Eventos e protocolo.','required'],
   ['Comprovantes e pendências fiscais ou municipais','Conforme situação concreta.','conditional'],
   ['Baixa de inscrições e licenças','Quando existirem.','conditional']
  ],
  encerramento:[
   ['CNPJ e atos constitutivos vigentes','Verificar registros e situação atual.','required'],
   ['Instrumento de distrato ou extinção','Conferir deliberação, assinaturas e representação.','required'],
   ['Qualificação dos sócios e signatários','Documentos e poderes pertinentes.','required'],
   ['Comprovantes fiscais e cadastrais','Conferir obrigações e inscrições em aberto.','conditional'],
   ['Protocolos de baixa perante os órgãos','Acompanhar respostas e exigências.','conditional'],
   ['Baixa de inscrições, alvarás e licenças','Conforme a atividade e localidade.','conditional']
  ],
  legalizacao_empresarial:[
   ['CNPJ, contrato social e últimas alterações','Para empresa já existente.','conditional'],
   ['Identificação dos responsáveis e procuradores','Dados e representação.','required'],
   ['Dados do endereço e do imóvel','Informações cadastrais.','conditional'],
   ['Atividades e CNAEs','Descrição e riscos.','required'],
   ['Consulta de viabilidade ou protocolo existente','Conforme etapa.','conditional'],
   ['Comprovantes de inscrições tributárias','Se existentes ou exigidas.','conditional'],
   ['Licenças, alvarás e autorizações setoriais','Conforme órgão.','conditional']
  ]
 };
 const normalizeService=value=>SERVICES.includes(String(value||'').trim())?String(value).trim():null;
 function referenceTemplatesFor(value){
  const service=normalizeService(value);
  if(!service)return [];
  return (STARTERS[service]||[]).map(([title,instructions,required_rule],index)=>({
   title,instructions,required_rule,category:'Documental',sort_order:index,applicability:required_rule==='conditional'?'to_confirm':'applicable'
  }));
 }
 function canTransition(from,to,{hasEvidence=false,reason=''}={}){
  if(!STATES.includes(from)||!STATES.includes(to))return {ok:false,error:'Estado desconhecido'};
  if(['returned','waived'].includes(to)&&!String(reason||'').trim())return {ok:false,error:'Justificativa obrigatória'};
  if(to==='received'&&!hasEvidence&&!String(reason||'').trim())return {ok:false,error:'Identifique o recebimento físico ou anexe evidência'};
  if(['approved','in_review'].includes(to)&&!hasEvidence)return {ok:false,error:'Evidência obrigatória'};
  return {ok:true,error:null};
 }
 const dateNumber=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?Date.parse(value+'T00:00:00Z'):NaN;
 function summarizeRequirements(rows=[],asOf=new Date().toISOString().slice(0,10)){
  const today=dateNumber(asOf);const byOrigin=Object.fromEntries(ORIGINS.map(origin=>[origin,0]));
  const result={total:rows.length,completed:0,open:0,overdue:0,dueSoon:0,byOrigin,byStatus:Object.fromEntries(STATES.map(s=>[s,0]))};
  for(const row of rows){
   if(row.archived_at)continue;
   if(result.byStatus[row.status]!==undefined)result.byStatus[row.status]++;
   if(DONE.has(row.status)){result.completed++;continue;}
   result.open++;
   if(byOrigin[row.pending_with]!==undefined)byOrigin[row.pending_with]++;
   const due=dateNumber(row.due_on),days=Math.round((due-today)/86400000);
   if(Number.isFinite(days)){if(days<0)result.overdue++;else if(days<=3)result.dueSoon++;}
  }
  return result;
 }
 function reconcilePreview(previous=[],next=[]){
  const byTitle=new Map((previous||[]).map(item=>[item.title,item]));
  return next.map(item=>({...item,...(byTitle.get(item.title)||{})}));
 }
 window.AtlasOpsV72DocumentModel=Object.freeze({SERVICES,STATES,ORIGINS,normalizeService,referenceTemplatesFor,summarizeRequirements,reconcilePreview,canTransition});
})();
