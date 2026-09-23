const UPSTREAM_BASE = 'https://publica.cnpj.ws/cnpj';
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ titulo: 'Método não permitido' });
  }

  const raw = Array.isArray(req.query?.cnpj) ? req.query.cnpj[0] : req.query?.cnpj;
  const cnpj = String(raw || '').replace(/\D/g, '');

  if (!validCnpj(cnpj)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({
      titulo: 'CNPJ inválido',
      detalhes: 'Informe 14 dígitos com verificadores corretos.'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const upstream = await fetch(UPSTREAM_BASE + '/' + cnpj, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ATLAS-CNPJ-EXPLORE/3.2'
      }
    });

    const responseText = await upstream.text();
    if (responseText.length > MAX_BODY_SIZE) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({
        titulo: 'Resposta muito grande',
        detalhes: 'A consulta retornou um volume de dados inesperado.'
      });
    }

    let body;
    try {
      body = JSON.parse(responseText);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({
        titulo: 'Resposta inválida',
        detalhes: 'O serviço externo não retornou JSON válido.'
      });
    }

    if (!upstream.ok) {
      const status = [400, 404, 429].includes(upstream.status) ? upstream.status : 502;
      const retryAfter = upstream.headers.get('retry-after');
      if (retryAfter) res.setHeader('Retry-After', retryAfter);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json({
        titulo: typeof body?.titulo === 'string' ? body.titulo : 'Falha na consulta',
        detalhes: typeof body?.detalhes === 'string'
          ? body.detalhes.slice(0, 600)
          : status === 404
            ? 'CNPJ não localizado.'
            : status === 429
              ? 'Limite temporário de consultas atingido. Aguarde e tente novamente.'
              : 'O serviço externo está indisponível.'
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({
        titulo: 'Resposta inesperada',
        detalhes: 'O serviço externo não retornou um cadastro válido.'
      });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=60');
    return res.status(200).json(body);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({
      titulo: 'Falha de comunicação',
      detalhes: error?.name === 'AbortError'
        ? 'A API demorou mais de 18 segundos para responder. Tente novamente.'
        : 'Não foi possível conectar à API CNPJws. Tente novamente em instantes.'
    });
  } finally {
    clearTimeout(timeout);
  }
}
