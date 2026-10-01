(() => {
  let trainingManuals=[];
  const FINANCE_VIDEO_URL='https://share.descript.com/view/AWRHQxeKbBc';

  function e(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function loadTrainingManuals(){
    if(trainingManuals.length)return trainingManuals;
    const res=await fetch('/training-manuals.json?v=1.1',{cache:'no-store'});
    if(!res.ok)throw new Error('Não foi possível carregar os manuais.');
    trainingManuals=await res.json();
    return trainingManuals;
  }

  function roleName(role){
    return ({admin:'Administrador',operacao:'Operação',financeiro:'Financeiro',auditoria:'Auditoria',cliente:'Cliente'})[role]||role;
  }

  window.trainingPage=async function(){
    const profile=atlasProfile();
    const currentRole=profile?.role||'cliente';

    setHead('Treinamento','TREINAMENTO','Manual de procedimentos e materiais de capacitação correspondentes ao seu perfil no ATLAS.');
    page('<div class="loading-box"><span class="spinner"></span><div>Carregando manuais...</div></div>');

    try{
      const allManuals=await loadTrainingManuals();
      const manuals=currentRole==='admin'?allManuals:allManuals.filter(m=>m.role===currentRole);
      page(`
        <section class="surface pad training-intro">
          <div>
            <h2>${currentRole==='admin'?'Kit de treinamento por perfil':'Treinamento do perfil '+e(roleName(currentRole))}</h2>
            <p>${currentRole==='admin'
              ? 'Acesse todos os manuais para integração de novos usuários, reciclagem da equipe e padronização dos procedimentos do ATLAS.'
              : 'Utilize este material para aprender os procedimentos, anexos, boas práticas e soluções correspondentes ao seu acesso.'}</p>
          </div>
          <span class="training-version">Versão 1.1 · Outubro/2026</span>
        </section>

        ${(currentRole==='admin'||currentRole==='financeiro')?`
          <section class="surface pad training-video-section">
            <div class="training-video-copy">
              <span class="training-kicker">VÍDEO DE TREINAMENTO</span>
              <h2>Perfil Financeiro · ATLAS</h2>
              <p>Treinamento atualizado do Perfil Financeiro, com controle de honorários, taxas, pagamentos, datas de pagamento, grupos empresariais e permissões.</p>
              <div class="training-video-meta"><span>▶ Aproximadamente 7 minutos</span><span>Perfil: Financeiro</span></div>
              <button class="btn btn-primary" type="button" onclick="openFinanceTrainingVideo()">▶ Assistir treinamento</button>
            </div>
            <div class="training-video-preview">
              <img src="/logo-atlas-legalizacao.png" alt="ATLAS">
              <span>Treinamento Financeiro</span>
            </div>
          </section>`:''}

        <section class="training-grid">
          ${manuals.map(m=>`
            <article class="surface training-card">
              <div class="training-role-icon">${e(roleName(m.role).slice(0,2).toUpperCase())}</div>
              <div class="training-card-body">
                <span class="training-kicker">PERFIL</span>
                <h3>${e(roleName(m.role))}</h3>
                <p>${e(m.subtitle)}</p>
                <div class="training-modules">${(m.modules||[]).slice(0,6).map(x=>`<span>${e(x)}</span>`).join('')}</div>
                <div class="training-actions">
                  <button class="btn btn-primary" onclick="openTrainingManual('${e(m.role)}')">Abrir manual</button>
                  <button class="btn btn-muted" onclick="printTrainingManual('${e(m.role)}')">Imprimir / Salvar PDF</button>
                </div>
              </div>
            </article>`
          ).join('')}
        </section>

        <section class="surface pad training-guidance">
          <h2>${currentRole==='admin'?'Uso recomendado no treinamento':'Como concluir seu treinamento'}</h2>
          <div class="training-steps">
            <div><strong>1</strong><span>${currentRole==='admin'?'Entregue o manual correspondente ao perfil antes do primeiro acesso.':'Leia o manual do seu perfil do início ao fim.'}</span></div>
            <div><strong>2</strong><span>${currentRole==='admin'?'Faça o usuário executar o checklist de treinamento no ambiente real.':'Execute o checklist de treinamento no ATLAS.'}</span></div>
            <div><strong>3</strong><span>${currentRole==='admin'?'Valide as permissões do perfil em Configurações antes de liberar o uso definitivo.':'Consulte a Base de Conhecimento sempre que surgir uma dúvida operacional.'}</span></div>
            <div><strong>4</strong><span>${currentRole==='admin'?'Use a Base de Conhecimento para dúvidas recorrentes e atualizações de procedimento.':'Em caso de bloqueio de acesso, solicite revisão de permissões ao Administrador.'}</span></div>
          </div>
        </section>
      `);
    }catch(err){
      page('<div class="error-box">'+e(err.message||err)+'</div>');
    }
  };

  function manualHtml(m){
    return `
      <article class="training-manual-view">
        <div class="training-manual-cover">
          <img src="/logo-atlas-legalizacao.png" alt="ATLAS">
          <span>MANUAL DE TREINAMENTO</span>
          <h1>PERFIL ${e(roleName(m.role).toUpperCase())}</h1>
          <p>${e(m.subtitle)}</p>
          <div class="training-meta">
            <div><span>Sistema</span><strong>ATLAS Legalização e Gerenciamento</strong></div>
            <div><span>Versão</span><strong>1.1 - Outubro/2026</strong></div>
            <div><span>Finalidade</span><strong>Treinamento, integração e consulta operacional</strong></div>
          </div>
        </div>

        <section>
          <h2>1. Objetivo do perfil</h2>
          <p>${e(m.objective)}</p>
        </section>

        <section>
          <h2>2. Módulos utilizados</h2>
          <div class="training-module-list">${(m.modules||[]).map(x=>`<span>${e(x)}</span>`).join('')}</div>
        </section>

        <section>
          <h2>3. Procedimentos de uso</h2>
          ${(m.procedures||[]).map((p,idx)=>`
            <div class="training-procedure">
              <h3>${idx+1}. ${e(p.title)}</h3>
              <ol>${(p.steps||[]).map(s=>`<li>${e(s)}</li>`).join('')}</ol>
            </div>`
          ).join('')}
        </section>

        <section>
          <h2>4. Onde anexar documentos</h2>
          <ul>${(m.attachments||[]).map(x=>`<li>${e(x)}</li>`).join('')}</ul>
        </section>

        <section>
          <h2>5. Solução de problemas comuns</h2>
          <div class="training-troubles">
            ${(m.troubles||[]).map(t=>`
              <div><strong>${e(t.issue)}</strong><span>${e(t.solution)}</span></div>`
            ).join('')}
          </div>
        </section>

        <section>
          <h2>6. Checklist de treinamento</h2>
          <div class="training-checklist">${(m.checklist||[]).map(x=>`<div>☐ ${e(x)}</div>`).join('')}</div>
          <div class="training-conclusion"><strong>Critério de conclusão</strong><span>O treinamento é considerado concluído quando o usuário consegue executar o checklist sem assistência e sabe localizar a Base de Conhecimento para dúvidas recorrentes.</span></div>
        </section>

        <section>
          <h2>7. Boas práticas</h2>
          <ul>
            <li>Utilize usuário individual e não compartilhe senhas.</li>
            <li>Mantenha títulos, nomes de arquivos e descrições claros e padronizados.</li>
            <li>Confirme empresa, processo e categoria antes de anexar documentos.</li>
            <li>Não altere registros fora da sua responsabilidade ou sem autorização.</li>
            <li>Sempre confirme o salvamento antes de fechar a tela.</li>
          </ul>
        </section>

        <footer class="training-manual-footer">© 2026 Marco Matos. Este programa e seus materiais de treinamento são de propriedade de Marco Matos. Proibida a reprodução, distribuição ou utilização não autorizada.</footer>
      </article>`;
  }

  window.openTrainingManual=async function(role){
    const currentRole=atlasProfile()?.role||'cliente';
    if(currentRole!=='admin'&&currentRole!==role)return;
    const manuals=await loadTrainingManuals();
    const m=manuals.find(x=>x.role===role);
    if(!m)return;
    modalShell(m.title,`
      ${manualHtml(m)}
      <div class="modal-actions training-modal-actions">
        <button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Fechar</button>
        <button type="button" class="btn btn-primary" onclick="printTrainingManual('${e(role)}')">Imprimir / Salvar PDF</button>
      </div>
    `,true);
  };

  window.printTrainingManual=async function(role){
    const currentRole=atlasProfile()?.role||'cliente';
    if(currentRole!=='admin'&&currentRole!==role)return;
    const manuals=await loadTrainingManuals();
    const m=manuals.find(x=>x.role===role);
    if(!m)return;

    const popup=window.open('','_blank');
    if(!popup){
      alert('Permita pop-ups para imprimir o manual.');
      return;
    }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${e(m.title)}</title><style>
      @page{size:A4;margin:16mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#17384f;margin:0;font-size:11px;line-height:1.55}
      .toolbar{position:sticky;top:0;background:#fff;padding:10px 0;text-align:right}
      .toolbar button{padding:9px 14px;border:1px solid #ccd9e1;background:#fff;border-radius:8px;font-weight:700}
      .training-manual-cover{text-align:center;padding:22px 0 28px;border-bottom:2px solid #0aa6a3}
      .training-manual-cover img{width:150px}
      .training-manual-cover>span{display:block;margin-top:12px;color:#0aa6a3;font-weight:800;letter-spacing:.08em}
      h1{font-size:25px;margin:8px 0;color:#0b2d45}
      .training-manual-cover>p{color:#607589}
      .training-meta{margin:20px auto 0;max-width:650px;text-align:left;border:1px solid #d7e2e9}
      .training-meta div{display:grid;grid-template-columns:120px 1fr;border-bottom:1px solid #d7e2e9}
      .training-meta div:last-child{border-bottom:0}
      .training-meta span{background:#eaf8f7;padding:7px;font-weight:700}.training-meta strong{padding:7px}
      section{margin-top:22px;break-inside:auto} h2{font-size:16px;border-bottom:2px solid #0aa6a3;padding-bottom:4px;color:#0b2d45}
      h3{font-size:12px;color:#0aa6a3;margin:15px 0 5px} ol,ul{padding-left:22px} li{margin:4px 0}
      .training-module-list{display:flex;flex-wrap:wrap;gap:6px}.training-module-list span{padding:5px 8px;background:#f2f7fa;border-radius:999px}
      .training-troubles>div{display:grid;grid-template-columns:180px 1fr;border:1px solid #d7e2e9;border-bottom:0}
      .training-troubles>div:last-child{border-bottom:1px solid #d7e2e9}
      .training-troubles strong,.training-troubles span{padding:7px}.training-troubles strong{background:#f6fafc}
      .training-checklist div{margin:5px 0}.training-conclusion{margin-top:12px;padding:10px;border:1px solid #0aa6a3;background:#eaf8f7}
      .training-conclusion strong,.training-conclusion span{display:block}.training-conclusion span{margin-top:3px;color:#607589}
      .training-manual-footer{margin-top:28px;padding-top:10px;border-top:1px solid #d7e2e9;text-align:center;color:#718394;font-size:9px}
      @media print{.toolbar{display:none}section,.training-procedure,.training-troubles>div{break-inside:avoid}}
    </style></head><body><div class="toolbar"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>${manualHtml(m)}</body></html>`);
    popup.document.close();
  };

  window.openFinanceTrainingVideo=function(){
    const role=atlasProfile()?.role||'cliente';
    if(!['admin','financeiro'].includes(role))return;
    window.open(FINANCE_VIDEO_URL,'_blank','noopener,noreferrer');
  };
})();