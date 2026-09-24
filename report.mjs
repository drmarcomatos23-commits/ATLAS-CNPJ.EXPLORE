/** Relatório HTML para impressão A4: expande campos, objetos e listas. */
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits = v => String(v ?? '').replace(/\D/g,'');
export function labelOf(key) {
 const known={cnpj:'CNPJ',cnpj_raiz:'CNPJ raiz',cnpj_ordem:'Ordem do CNPJ',cnpj_digito_verificador:'Dígito verificador',cpf_cnpj_socio:'CPF/CNPJ do sócio',cpf_representante_legal:'CPF do representante legal',razao_social:'Razão social',capital_social:'Capital social',estabelecimento:'Estabelecimento',socios:'Quadro societário',email:'E-mail',inscricoes_estaduais:'Inscrições estaduais',inscricao_estadual:'Inscrição estadual',atividades_secundarias:'Atividades secundárias',atividade_principal:'Atividade principal',natureza_juridica:'Natureza jurídica',qualificacao_socio:'Qualificação do sócio',qualificacao_representante:'Qualificação do representante',ibge_id:'Código IBGE',siafi_id:'Código SIAFI',uf:'UF',ddd1:'DDD 1',ddd2:'DDD 2',cep:'CEP',mei:'MEI',simples:'Simples Nacional',id:'Código',descricao:'Descrição',atualizado_em:'Atualizado em'};
 return known[key] || String(key).replaceAll('_',' ').replace(/\b\w/g,c=>c.toLocaleUpperCase('pt-BR'));
}
export function formatReportValue(value,key=''){
 if(value===null||value===undefined||value==='')return 'Não informado';
 if(typeof value==='boolean')return value?'Sim':'Não';
 if(key==='capital_social'){const n=Number(String(value).trim().replace(',','.'));if(Number.isFinite(n))return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);}
 if((key==='cnpj'||key==='cpf_cnpj_socio')&&digits(value).length===14){const d=digits(value);return d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'/'+d.slice(8,12)+'-'+d.slice(12);}
 if(key==='cep'&&digits(value).length===8)return digits(value).slice(0,5)+'-'+digits(value).slice(5);
 if(typeof value==='string'&&/^(?:data_|.*_em$|.*_at$)/.test(key)){const m=/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);if(m)return m[3]+'/'+m[2]+'/'+m[1];}
 return String(value);
}
export function renderDataNode(name,value,key='',level=0){
 const title=escapeHtml(name);
 if(value===null||typeof value!=='object')return '<div class="report-field"><span>'+title+'</span><strong>'+escapeHtml(formatReportValue(value,key))+'</strong></div>';
 if(Array.isArray(value)){
  if(!value.length)return '<div class="report-list"><h4>'+title+'</h4><p>Sem registros informados.</p></div>';
  return '<div class="report-list"><h4>'+title+' <small>('+value.length+')</small></h4>'+value.map((item,i)=>{
   if(item===null||typeof item!=='object')return '<div class="report-record"><strong class="record-heading">Item '+(i+1)+'</strong>'+renderDataNode('Valor',item,key,level+1)+'</div>';
   return '<div class="report-record"><strong class="record-heading">Item '+(i+1)+(item.nome?' · '+escapeHtml(item.nome):'')+'</strong>'+Object.entries(item).map(([k,v])=>renderDataNode(labelOf(k),v,k,level+1)).join('')+'</div>';
  }).join('')+'</div>';
 }
 const entries=Object.entries(value);
 if(!entries.length)return '<div class="report-list"><h4>'+title+'</h4><p>Sem registros informados.</p></div>';
 return '<div class="report-object"><h4>'+title+'</h4><div class="report-fields">'+entries.map(([k,v])=>renderDataNode(labelOf(k),v,k,level+1)).join('')+'</div></div>';
}
export function buildReportHtml(data,model,printedAt=new Date(),comparison=null){
 const area=(name,v)=>'<section class="report-chapter"><h2>'+escapeHtml(name)+'</h2>'+renderDataNode(name,v)+'</section>';
 const basics=Object.fromEntries(Object.entries(data).filter(([k])=>k!=='estabelecimento'&&k!=='socios'));
 const fields=[['Razão social',model.razaoSocial],['Nome fantasia',model.fantasia],['Capital social',model.capital],['Porte',model.porte],['Início das atividades',model.inicio],['Endereço',model.address],['Cidade/UF',model.cityUf],['CNAE principal',model.activity],['Telefone',model.phones],['E-mail',model.email]];
 return '<div class="print-page"><header class="print-header"><img class="print-logo" src="/logo-atlas.png" alt="ATLAS CNPJ.EXPLORE"><div><div class="print-kicker">RELATÓRIO CADASTRAL · ATLAS CNPJ.EXPLORE</div><h1>'+escapeHtml(model.razaoSocial)+'</h1><p>CNPJ '+escapeHtml(model.cnpj||'')+' · Situação '+escapeHtml(model.status)+'</p><p>Emitido em '+escapeHtml(printedAt.toLocaleString('pt-BR'))+'</p></div></header>'
 +'<section class="report-chapter report-summary"><h2>Resumo empresarial</h2><div class="report-fields">'+fields.map(([k,v])=>'<div class="report-field"><span>'+escapeHtml(k)+'</span><strong>'+escapeHtml(v||'Não informado')+'</strong></div>').join('')+'</div></section>'
 +area('Dados da empresa',basics)+area('Estabelecimento e atividades',data.estabelecimento||{})+area('Quadro societário',data.socios||[])
 + (comparison?.fontes?.length ? '<section class="report-chapter"><h2>Conferência complementar de dados</h2><p>Dados apresentados por fonte, sem substituição do cadastro original. Diferenças podem decorrer de atualização ou normalização.</p>'+[['razao_social','Razão social'],['nome_fantasia','Nome fantasia'],['situacao_cadastral','Situação cadastral'],['capital_social','Capital social'],['cnae_principal','CNAE principal'],['municipio','Município'],['uf','UF']].map(([key,title])=>'<div class="report-record"><strong class="record-heading">'+escapeHtml(title)+'</strong>'+[comparison.principal,...comparison.fontes].map(source=>'<div class="report-field"><span>'+escapeHtml(source.fonte)+'</span><strong>'+escapeHtml(source[key]??'Não informado')+'</strong></div>').join('')+'</div>').join('')+'<p>Consulta complementar: '+escapeHtml(comparison.consultado_em)+'. Fontes: BrasilAPI e/ou OpenCNPJ, conforme disponibilidade.</p></section>' : '')
 +'<footer class="print-footer">Fonte cadastral principal: API pública CNPJws. Dados sujeitos à atualização. Confirme informações essenciais nas bases oficiais.</footer></div>';
}

