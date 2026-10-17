(() => {
  const originalOpenProcessModal = window.openProcessModal;

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatTaxId(value) {
    const d = onlyDigits(value).slice(0, 14);
    if (d.length !== 14) return value || '';
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  function getCompanyFromCnpjPayload(d) {
    const e = d?.estabelecimento || {};
    const city = typeof e.cidade === 'object' ? e.cidade?.nome : e.cidade;
    const state = typeof e.estado === 'object' ? e.estado?.sigla : e.estado;
    const ieList = Array.isArray(e.inscricoes_estaduais) ? e.inscricoes_estaduais : [];
    const ie = ieList.find(x => x?.ativo !== false && (typeof x?.estado === 'object' ? x.estado?.sigla : x?.estado) === state)
      || ieList.find(x => x?.ativo !== false)
      || ieList[0];
    return {
      legal_name: d?.razao_social || '',
      trade_name: e?.nome_fantasia || '',
      tax_id: formatTaxId(e?.cnpj || d?.cnpj || ''),
      state_registration: ie?.inscricao_estadual ? String(ie.inscricao_estadual) : '',
      city: city || '',
      state: state || ''
    };
  }

  async function consultQuickCnpj() {
    const input = document.getElementById('quick-company-cnpj');
    const msg = document.getElementById('quick-company-message');
    const btn = document.getElementById('quick-company-consult');
    if (!input || !msg || !btn) return;

    const cnpj = onlyDigits(input.value);
    if (cnpj.length !== 14) {
      msg.textContent = 'Informe os 14 dígitos do CNPJ.';
      msg.className = 'auth-message error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Consultando...';
    msg.className = 'auth-message hidden';

    try {
      const res = await fetch('/api/cnpj?cnpj=' + encodeURIComponent(cnpj), {
        headers: { Accept: 'application/json' }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detalhes || data?.titulo || 'Não foi possível consultar o CNPJ.');

      const company = getCompanyFromCnpjPayload(data);
      document.getElementById('quick-company-cnpj').value = company.tax_id;
      document.getElementById('quick-company-legal-name').value = company.legal_name;
      document.getElementById('quick-company-trade-name').value = company.trade_name;
      document.getElementById('quick-company-city').value = company.city;
      document.getElementById('quick-company-state').value = company.state;
      const ieInput = document.getElementById('quick-company-ie');
      if (ieInput) ieInput.value = company.state_registration || '';

      msg.textContent = 'Dados carregados. Revise as informações e clique em “Cadastrar empresa”.';
      msg.className = 'auth-message success';
    } catch (err) {
      msg.textContent = err.message || 'Falha na consulta do CNPJ.';
      msg.className = 'auth-message error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Consultar CNPJ';
    }
  }

  async function saveQuickCompany() {
    const db = atlasDb();
    const profile = atlasProfile();
    const btn = document.getElementById('quick-company-save');
    const msg = document.getElementById('quick-company-message');
    const select = document.getElementById('proc-client');

    if (!db || !profile?.organization_id || !btn || !msg || !select) return;

    const legalName = document.getElementById('quick-company-legal-name')?.value.trim();
    const tradeName = document.getElementById('quick-company-trade-name')?.value.trim() || null;
    const cnpjRaw = document.getElementById('quick-company-cnpj')?.value.trim() || '';
    const cnpjDigits = onlyDigits(cnpjRaw);
    const taxId = cnpjDigits.length === 14 ? formatTaxId(cnpjDigits) : (cnpjRaw || null);
    const city = document.getElementById('quick-company-city')?.value.trim() || null;
    const state = document.getElementById('quick-company-state')?.value.trim().toUpperCase() || null;
    const contactName = document.getElementById('quick-company-contact')?.value.trim() || null;
    const email = document.getElementById('quick-company-email')?.value.trim() || null;
    const stateRegistration = document.getElementById('quick-company-ie')?.value.trim() || null;
    const municipalRegistration = document.getElementById('quick-company-im')?.value.trim() || null;
    const groupId = document.getElementById('quick-company-group')?.value || null;

    if (!legalName) {
      msg.textContent = 'Informe a razão social.';
      msg.className = 'auth-message error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';
    msg.className = 'auth-message hidden';

    try {
      if (cnpjDigits.length === 14) {
        const { data: existing, error: existingError } = await db
          .from('clients')
          .select('id,legal_name,tax_id')
          .eq('organization_id', profile.organization_id);

        if (existingError) throw existingError;

        const duplicate = (existing || []).find(c => onlyDigits(c.tax_id) === cnpjDigits);
        if (duplicate) {
          if (![...select.options].some(o => o.value === duplicate.id)) {
            select.add(new Option(duplicate.legal_name, duplicate.id));
          }
          select.value = duplicate.id;
          msg.textContent = 'Este CNPJ já estava cadastrado. A empresa existente foi selecionada.';
          msg.className = 'auth-message info';
          setTimeout(() => {
            document.getElementById('quick-company-panel')?.classList.add('hidden');
          }, 900);
          return;
        }
      }

      const { data: created, error } = await db
        .from('clients')
        .insert({
          organization_id: profile.organization_id,
          legal_name: legalName,
          trade_name: tradeName,
          tax_id: taxId,
          group_id: groupId,
          city,
          state,
          contact_name: contactName,
          email,
          state_registration: stateRegistration,
          municipal_registration: municipalRegistration
        })
        .select('id,legal_name,tax_id')
        .single();

      if (error) throw error;

      select.add(new Option(created.legal_name, created.id));
      select.value = created.id;
      window.atlasRealtime?.refreshCompanies?.();

      msg.textContent = 'Empresa cadastrada e selecionada no processo.';
      msg.className = 'auth-message success';

      setTimeout(() => {
        document.getElementById('quick-company-panel')?.classList.add('hidden');
      }, 650);
    } catch (err) {
      msg.textContent = err.message || 'Não foi possível cadastrar a empresa.';
      msg.className = 'auth-message error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Cadastrar empresa';
    }
  }

  function toggleQuickCompany() {
    const panel = document.getElementById('quick-company-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      document.getElementById('quick-company-cnpj')?.focus();
    }
  }

  window.openProcessModal = async function(id = '') {
    if (id) return originalOpenProcessModal(id);

    const db = atlasDb();
    const data = await loadOperationalData();

    const template = data.templates[0];
    const stagesFor = data.stages
      .filter(s => !template || s.workflow_template_id === template.id)
      .sort((a, b) => a.position - b.position);
    const firstStage = stagesFor[0];

    modalShell('Novo processo', `<form id="process-real-form" class="modal-form-grid">
      <div class="field span-2">
        <label>Título do processo *</label>
        <input id="proc-title" required placeholder="Ex.: Alteração contratual, abertura de empresa, licenciamento...">
      </div>

      <div class="field company-field">
        <label>Empresa *</label>
        <div class="company-select-row">
          <select id="proc-client" required>
            ${data.clients.length
              ? clientSelectOptions(data)
              : '<option value="">Nenhuma empresa cadastrada</option>'}
          </select>
          <button id="quick-company-toggle" class="btn btn-muted company-add-btn" type="button">＋ Nova empresa</button>
        </div>
      </div>

      <div class="field">
        <label>Tipo de serviço</label>
        <select id="proc-service">
          <option value="legalizacao_empresarial" selected>Legalização empresarial</option>
          <option value="abertura">Abertura</option>
          <option value="alteracao_societaria">Alteração societária</option>
          <option value="regularizacao">Regularização</option>
          <option value="licenciamento">Licenciamento</option>
          <option value="baixa">Baixa</option>
          <option value="encerramento">Encerramento</option>
        </select>
      </div>

      <div id="quick-company-panel" class="quick-company-panel hidden span-2">
        <div class="quick-company-head">
          <div>
            <strong>Cadastrar empresa sem sair do processo</strong>
            <span>Consulte o CNPJ para preencher automaticamente os dados principais.</span>
          </div>
          <button type="button" class="modal-close mini-close" id="quick-company-close">×</button>
        </div>

        <div class="quick-company-grid">
          <div class="field quick-cnpj-field">
            <label>CNPJ</label>
            <div class="quick-cnpj-row">
              <input id="quick-company-cnpj" inputmode="numeric" placeholder="00.000.000/0000-00">
              <button id="quick-company-consult" class="btn btn-muted" type="button">Consultar CNPJ</button>
            </div>
          </div>
          <div class="field">
            <label>Razão social *</label>
            <input id="quick-company-legal-name" placeholder="Razão social">
          </div>
          <div class="field">
            <label>Nome fantasia</label>
            <input id="quick-company-trade-name">
          </div>
          <div class="field">
            <label>Inscrição Estadual</label>
            <input id="quick-company-ie" placeholder="IE">
          </div>
          <div class="field">
            <label>Inscrição Municipal</label>
            <input id="quick-company-im" placeholder="IM">
          </div>
          <div class="field">
            <label>Grupo empresarial</label>
            <select id="quick-company-group">
              <option value="">Sem grupo</option>
              ${(data.groups||[]).map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Cidade</label>
            <input id="quick-company-city">
          </div>
          <div class="field">
            <label>UF</label>
            <input id="quick-company-state" maxlength="2">
          </div>
          <div class="field">
            <label>Contato</label>
            <input id="quick-company-contact">
          </div>
          <div class="field">
            <label>E-mail</label>
            <input id="quick-company-email" type="email">
          </div>
        </div>

        <div id="quick-company-message" class="auth-message hidden"></div>
        <div class="quick-company-actions">
          <button id="quick-company-save" class="btn btn-primary" type="button">Cadastrar empresa</button>
        </div>
      </div>

      <div class="field">
        <label>Etapa atual *</label>
        <select id="proc-stage" required>
          ${stagesFor.map(s => `<option value="${s.id}" ${firstStage?.id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>Responsável</label>
        <select id="proc-owner">
          <option value="">Não atribuído</option>
          ${data.profiles.filter(p => ['admin','operacao'].includes(p.role)).map(p => `<option value="${p.id}">${esc(p.full_name)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>Prioridade</label>
        <select id="proc-priority">
          <option value="low">Baixa</option>
          <option value="normal" selected>Normal</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      <div class="field">
        <label>Status</label>
        <select id="proc-status">
          <option value="open" selected>Aberto</option>
          <option value="in_progress">Em andamento</option>
          <option value="pending">Pendência</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      <div class="field">
        <label>Prazo</label>
        <input id="proc-due" type="date">
      </div>

      <div class="modal-actions span-2">
        <button type="button" class="btn btn-muted" onclick="closeAtlasModal()">Cancelar</button>
        <button id="proc-save-btn" class="btn btn-primary" type="submit">Salvar processo</button>
      </div>
      <div id="proc-form-message" class="auth-message hidden span-2"></div>
    </form>`, true);

    document.getElementById('quick-company-toggle')?.addEventListener('click', toggleQuickCompany);
    document.getElementById('quick-company-close')?.addEventListener('click', toggleQuickCompany);
    document.getElementById('quick-company-consult')?.addEventListener('click', consultQuickCnpj);
    document.getElementById('quick-company-save')?.addEventListener('click', saveQuickCompany);

    const cnpjInput = document.getElementById('quick-company-cnpj');
    cnpjInput?.addEventListener('input', () => {
      const d = onlyDigits(cnpjInput.value);
      cnpjInput.value = d.length === 14 ? formatTaxId(d) : d;
    });

    document.getElementById('process-real-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('proc-save-btn');
      const msg = document.getElementById('proc-form-message');
      const clientId = document.getElementById('proc-client')?.value;

      if (!clientId) {
        msg.textContent = 'Cadastre ou selecione uma empresa antes de salvar o processo.';
        msg.className = 'auth-message error span-2';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Salvando...';

      const status = document.getElementById('proc-status').value;
      const payload = {
        organization_id: atlasProfile().organization_id,
        client_id: clientId,
        workflow_template_id: template?.id || null,
        title: document.getElementById('proc-title').value.trim(),
        service_type: document.getElementById('proc-service').value,
        status,
        current_stage_id: document.getElementById('proc-stage').value || null,
        owner_id: document.getElementById('proc-owner').value || null,
        priority: document.getElementById('proc-priority').value,
        due_date: document.getElementById('proc-due').value || null,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      };

      const { error } = await db.from('processes').insert(payload);
      if (error) {
        msg.textContent = error.message;
        msg.className = 'auth-message error span-2';
        btn.disabled = false;
        btn.textContent = 'Salvar processo';
        return;
      }

      closeAtlasModal();
      await processPage();
    });
  };
  window.atlasQuickCompany={consultQuickCnpj,saveQuickCompany,toggleQuickCompany};
})();