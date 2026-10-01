const CNPJWS_BASE = 'https://publica.cnpj.ws/cnpj';
const BRASILAPI_BASE = 'https://brasilapi.com.br/api/cnpj/v1';
const MAX_BODY_SIZE = 3 * 1024 * 1024;

function validCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  function digit(base, weights) {
    const total = [...base].reduce((sum, char, index) => sum + Number(char) * weights[index], 0);
    return total % 11 < 2 ? 0 : 11 - (total % 11);
  }
  const a = digit(cnpj.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const b = digit(cnpj.slice(0, 12) + a, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return cnpj.endsWith(String(a) + String(b));
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ATLAS-LEGALIZACAO/3.4' }
    });
    const text = await response.text();
    if (text.length > MAX_BODY_SIZE) throw new Error('Resposta muito grande');
    let body;
    try { body = JSON.parse(text); } catch { throw new Error('Resposta JSON inválida'); }
    if (!response.ok) {
      const err = new Error(body?.detalhes || body?.message || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return body;
  } finally { clearTimeout(timeout); }
}

function normalizeBrasilApi(b, cnpj) {
  const secondary = Array.isArray(b?.cnaes_secundarios) ? b.cnaes_secundarios : [];
  const partners = Array.isArray(b?.qsa) ? b.qsa : [];
  return {
    _atlas_source: 'BrasilAPI (fallback)',
    razao_social: b?.razao_social || b?.nome_fantasia || '',
    capital_social: b?.capital_social ?? null,
    natureza_juridica: { descricao: b?.descricao_natureza_juridica || b?.natureza_juridica || '' },
    porte: { descricao: b?.porte || '' },
    estabelecimento: {
      cnpj: b?.cnpj || cnpj,
      nome_fantasia: b?.nome_fantasia || '',
      situacao_cadastral: b?.descricao_situacao_cadastral || String(b?.situacao_cadastral || ''),
      data_inicio_atividade: b?.data_inicio_atividade || '',
      tipo_logradouro: b?.descricao_tipo_de_logradouro || '',
      logradouro: b?.logradouro || '',
      numero: b?.numero || '',
      complemento: b?.complemento || '',
      bairro: b?.bairro || '',
      cep: b?.cep || '',
      cidade: { nome: b?.municipio || '' },
      estado: { sigla: b?.uf || '' },
      atividade_principal: {
        id: b?.cnae_fiscal ? String(b.cnae_fiscal) : '',
        descricao: b?.cnae_fiscal_descricao || ''
      },
      atividades_secundarias: secondary.map(x => ({
        id: x?.codigo ? String(x.codigo) : '',
        descricao: x?.descricao || ''
      }))
    },
    socios: partners.map(p => ({
      nome: p?.nome_socio || p?.nome || '',
      cpf_cnpj_socio: p?.cnpj_cpf_do_socio || p?.cpf_cnpj_socio || '',
      tipo: p?.identificador_de_socio || p?.tipo || '',
      qualificacao_socio: { descricao: p?.qualificacao_socio || '' },
      data_entrada_sociedade: p?.data_entrada_sociedade || ''
    }))
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ titulo: 'Método não permitido' });
  }
  const raw = Array.isArray(req.query?.cnpj) ? req.query.cnpj[0] : req.query?.cnpj;
  const cnpj = String(raw || '').replace(/\D/g, '');
  if (!validCnpj(cnpj)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ titulo: 'CNPJ inválido', detalhes: 'Informe 14 dígitos com verificadores corretos.' });
  }

  let firstError = null;
  try {
    const body = await fetchJson(`${CNPJWS_BASE}/${cnpj}`, 9000);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Cadastro inválido');
    body._atlas_source = 'CNPJws';
    res.setHeader('X-Atlas-Source', 'cnpjws');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');
    return res.status(200).json(body);
  } catch (error) {
    firstError = error;
  }

  try {
    const fallback = await fetchJson(`${BRASILAPI_BASE}/${cnpj}`, 9000);
    const body = normalizeBrasilApi(fallback, cnpj);
    res.setHeader('X-Atlas-Source', 'brasilapi');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(body);
  } catch (fallbackError) {
    res.setHeader('Cache-Control', 'no-store');
    const timedOut = firstError?.name === 'AbortError' || fallbackError?.name === 'AbortError';
    return res.status(502).json({
      titulo: 'Falha de comunicação',
      detalhes: timedOut
        ? 'As fontes de consulta demoraram para responder. Tente novamente em instantes.'
        : 'CNPJws e BrasilAPI estão temporariamente indisponíveis. Tente novamente em instantes.'
    });
  }
}