import postgres from "npm:postgres@3.4.5";

// ATLAS Legalização — Monitoramento de CNPJ da carteira (custo zero).
// Consulta a base pública (BrasilAPI, com CNPJws como reserva), guarda um retrato do cadastro
// em client_registry_snapshots e avisa no sino quando algo relevante muda.
// Empresas BAIXADAS são reconferidas só a cada 60 dias.
// Chamado de hora em hora pelo pg_cron (token no Vault) ou pelo botão "Verificar agora" (JWT de Admin/Operação).

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1, idle_timeout: 5, max_lifetime: 120 });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const STALE_DAYS = 6;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-atlas-cron-token", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown) => String(v ?? "").trim();
const up = (v: unknown) => txt(v).toUpperCase().replace(/\s+/g, " ");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sameToken(a: string, b: string) { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function validCnpj(c: string) {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (b: string, w: number[]) => { const s = [...b].reduce((a, x, i) => a + Number(x) * w[i], 0); return s % 11 < 2 ? 0 : 11 - (s % 11); };
  const a = dv(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const b = dv(c.slice(0, 12) + a, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.endsWith(`${a}${b}`);
}

async function getJson(url: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ATLAS-LEGALIZACAO-MONITOR/1.0" }, signal: AbortSignal.timeout(12000) }).catch((e) => ({ ok: false, status: 0, e } as any));
    if (r.ok) return await r.json();
    if (r.status === 404) { const e: any = new Error("NOT_FOUND"); e.notFound = true; throw e; }
    if (attempt === 0 && [0, 429, 500, 502, 503, 504].includes(r.status)) { await sleep(2500); continue; }
    throw new Error("HTTP_" + r.status);
  }
  throw new Error("UNAVAILABLE");
}

// Retrato normalizado só com o que importa para a legalização.
function fromBrasilApi(b: any) {
  return {
    fonte: "BrasilAPI",
    situacao: up(b?.descricao_situacao_cadastral || b?.situacao_cadastral),
    data_situacao: txt(b?.data_situacao_cadastral),
    motivo_situacao: up(b?.descricao_motivo_situacao_cadastral),
    razao_social: up(b?.razao_social),
    nome_fantasia: up(b?.nome_fantasia),
    natureza: up(b?.natureza_juridica || b?.descricao_natureza_juridica),
    capital_social: Number(b?.capital_social ?? 0) || 0,
    endereco: [up(b?.descricao_tipo_de_logradouro), up(b?.logradouro), up(b?.numero), up(b?.complemento), up(b?.bairro), digits(b?.cep), up(b?.municipio), up(b?.uf)].filter(Boolean).join(" | "),
    cnae_principal: txt(b?.cnae_fiscal),
    cnaes_secundarios: (Array.isArray(b?.cnaes_secundarios) ? b.cnaes_secundarios : []).map((x: any) => txt(x?.codigo)).filter((x: string) => x && x !== "0").sort(),
    socios: (Array.isArray(b?.qsa) ? b.qsa : []).map((s: any) => `${up(s?.nome_socio)} (${up(s?.qualificacao_socio)})`).sort(),
    simples: b?.opcao_pelo_simples === true ? "SIM" : b?.opcao_pelo_simples === false ? "NÃO" : "",
    mei: b?.opcao_pelo_mei === true ? "SIM" : b?.opcao_pelo_mei === false ? "NÃO" : ""
  };
}
function fromCnpjWs(d: any) {
  const e = d?.estabelecimento || {};
  return {
    fonte: "CNPJws",
    situacao: up(e?.situacao_cadastral),
    data_situacao: txt(e?.data_situacao_cadastral),
    motivo_situacao: up(e?.motivo_situacao_cadastral?.descricao),
    razao_social: up(d?.razao_social),
    nome_fantasia: up(e?.nome_fantasia),
    natureza: up(d?.natureza_juridica?.descricao),
    capital_social: Number(String(d?.capital_social ?? "0").replace(",", ".")) || 0,
    endereco: [up(e?.tipo_logradouro), up(e?.logradouro), up(e?.numero), up(e?.complemento), up(e?.bairro), digits(e?.cep), up(e?.cidade?.nome), up(e?.estado?.sigla)].filter(Boolean).join(" | "),
    cnae_principal: digits(e?.atividade_principal?.id || e?.atividade_principal?.subclasse),
    cnaes_secundarios: (Array.isArray(e?.atividades_secundarias) ? e.atividades_secundarias : []).map((x: any) => digits(x?.id || x?.subclasse)).filter(Boolean).sort(),
    socios: (Array.isArray(d?.socios) ? d.socios : []).map((s: any) => `${up(s?.nome)} (${up(s?.qualificacao_socio?.descricao)})`).sort(),
    simples: d?.simples?.simples === "Sim" ? "SIM" : d?.simples?.simples === "Não" ? "NÃO" : "",
    mei: d?.simples?.mei === "Sim" ? "SIM" : d?.simples?.mei === "Não" ? "NÃO" : ""
  };
}

async function fetchCnpj(cnpj: string) {
  try { return fromBrasilApi(await getJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)); }
  catch (e: any) {
    if (e?.notFound) throw e;
    await sleep(1200);
    return fromCnpjWs(await getJson(`https://publica.cnpj.ws/cnpj/${cnpj}`));
  }
}

// Compara campos que a fonte de fato informou (evita falso alerta quando uma fonte não traz o campo).
function diff(prev: any, cur: any) {
  const out: { campo: string; antes: string; depois: string; grave?: boolean }[] = [];
  const cmp = (campo: string, a: unknown, b: unknown, grave = false) => {
    const A = Array.isArray(a) ? a.join("; ") : txt(a), B = Array.isArray(b) ? b.join("; ") : txt(b);
    if (!B || !A) return; if (A !== B) out.push({ campo, antes: A, depois: B, grave });
  };
  cmp("Situação cadastral", prev.situacao, cur.situacao, true);
  cmp("Razão social", prev.razao_social, cur.razao_social);
  cmp("Nome fantasia", prev.nome_fantasia, cur.nome_fantasia);
  cmp("Endereço", prev.endereco, cur.endereco);
  cmp("CNAE principal", prev.cnae_principal, cur.cnae_principal);
  if (prev.fonte === cur.fonte) cmp("CNAEs secundários", prev.cnaes_secundarios, cur.cnaes_secundarios);
  if (prev.fonte === cur.fonte) cmp("Quadro de sócios", prev.socios, cur.socios, true);
  if (prev.capital_social && cur.capital_social && Number(prev.capital_social) !== Number(cur.capital_social)) out.push({ campo: "Capital social", antes: String(prev.capital_social), depois: String(cur.capital_social) });
  cmp("Natureza jurídica", prev.natureza, cur.natureza);
  cmp("Opção pelo Simples", prev.simples, cur.simples, true);
  cmp("MEI", prev.mei, cur.mei);
  return out;
}

async function notify(orgId: string, clientId: string, title: string, body: string, dedupe: string, meta: Record<string, unknown>) {
  await sql`insert into public.atlas_notifications (organization_id, recipient_profile_id, event_type, title, body, client_id, metadata)
    select ${orgId}::uuid, a.user_id, 'cnpj_change', ${title}, ${body}, ${clientId}::uuid, ${sql.json({ ...meta, dedupe_key: dedupe })}
    from public.atlas_hub_system_access a join public.profiles p on p.id = a.user_id and p.active
    where a.organization_id = ${orgId}::uuid and a.system_key = 'legalizacao' and a.allowed and a.system_role in ('admin','operacao')
      and not exists (select 1 from public.atlas_notifications x where x.recipient_profile_id = a.user_id and x.metadata ->> 'dedupe_key' = ${dedupe})`;
}

async function checkOne(c: { id: string; organization_id: string; legal_name: string; tax_id: string }) {
  const cnpj = digits(c.tax_id);
  let cur: any;
  try { cur = await fetchCnpj(cnpj); }
  catch (e: any) {
    const status = e?.notFound ? "NAO_ENCONTRADO" : "FALHA_CONSULTA";
    await sql`insert into public.client_registry_snapshots (client_id, source, tax_id, payload, fetched_at)
      values (${c.id}::uuid, ${e?.notFound ? "monitor_erro" : "monitor_falha"}, ${cnpj}, ${sql.json({ erro: status })}, now())`;
    if (e?.notFound) await notify(c.organization_id, c.id, `CNPJ não encontrado: ${c.legal_name}`, `O CNPJ ${c.tax_id} não foi localizado na base pública. Confira o cadastro.`, `cnpj404:${c.id}`, { cnpj });
    return { ok: false, status };
  }
  const prevRows = await sql`select payload from public.client_registry_snapshots where client_id = ${c.id}::uuid and source = 'monitor' order by fetched_at desc limit 1`;
  const prev = prevRows[0]?.payload || null;
  const changes = prev ? diff(prev, cur) : [];
  await sql`insert into public.client_registry_snapshots (client_id, source, tax_id, payload, fetched_at)
    values (${c.id}::uuid, 'monitor', ${cnpj}, ${sql.json({ ...cur, alteracoes: changes })}, now())`;

  const irregular = cur.situacao && cur.situacao !== "ATIVA";
  if (!prev && irregular) {
    await notify(c.organization_id, c.id, `${c.legal_name}: situação ${cur.situacao}`, `Primeira verificação do monitoramento. Situação cadastral ${cur.situacao}${cur.motivo_situacao ? " — " + cur.motivo_situacao : ""}${cur.data_situacao ? " desde " + cur.data_situacao : ""}.`, `cnpjsit:${c.id}:${cur.situacao}`, { cnpj, situacao: cur.situacao });
  }
  if (changes.length) {
    const grave = changes.find((x) => x.grave);
    const head = changes.find((x) => x.campo === "Situação cadastral") ? `${c.legal_name}: situação mudou para ${cur.situacao}` : `${c.legal_name}: ${changes.map((x) => x.campo.toLowerCase()).join(", ")} alterado(s)`;
    const body = changes.map((x) => `${x.campo}: ${x.antes.slice(0, 120)} → ${x.depois.slice(0, 120)}`).join(" · ").slice(0, 900);
    await notify(c.organization_id, c.id, head.slice(0, 200), body, `cnpjchg:${c.id}:${changes.map((x) => x.campo + "=" + x.depois).join("|").slice(0, 300)}`, { cnpj, grave: !!grave, campos: changes.map((x) => x.campo) });
  }
  return { ok: true, changes: changes.length, irregular };
}

async function authorizedUser(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  const rows = await sql`select a.organization_id::text org from public.atlas_hub_system_access a join public.profiles p on p.id = a.user_id and p.active
    where a.user_id = ${u.id}::uuid and a.system_key = 'legalizacao' and a.allowed and a.system_role in ('admin','operacao') limit 1`;
  return rows[0]?.org || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const cronInput = req.headers.get("x-atlas-cron-token") ?? "";
    let orgFilter: string | null = null, manual = false;
    if (cronInput) {
      const token = await sql`select decrypted_secret token from vault.decrypted_secrets where name = 'atlas_legalizacao_cnpj_cron_token' limit 1`;
      if (!token.length || !sameToken(cronInput, String(token[0].token))) return json({ error: "unauthorized" }, 401);
    } else {
      orgFilter = await authorizedUser(req);
      if (!orgFilter) return json({ error: "unauthorized" }, 401);
      manual = true;
    }
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(manual ? 10 : 12, Number(body?.limit) || (manual ? 10 : 12)));
    const due = await sql`
      select c.id::text, c.organization_id::text, c.legal_name, c.tax_id
      from public.clients c
      left join lateral (select max(case when s.source = 'monitor_falha' then s.fetched_at - interval '5 days' else s.fetched_at end) last from public.client_registry_snapshots s where s.client_id = c.id and s.source in ('monitor','monitor_erro','monitor_falha')) s on true
      where c.deleted_at is null and length(regexp_replace(coalesce(c.tax_id,''), '\\D', '', 'g')) = 14
        and (${orgFilter}::uuid is null or c.organization_id = ${orgFilter}::uuid)
        and (s.last is null or s.last < now() - make_interval(days => ${STALE_DAYS}::int))
        and not exists (select 1 from (select s2.payload ->> 'situacao' sit, s2.fetched_at from public.client_registry_snapshots s2
          where s2.client_id = c.id and s2.source = 'monitor' order by s2.fetched_at desc limit 1) z
          where z.sit = 'BAIXADA' and z.fetched_at > now() - interval '60 days')
      order by s.last nulls first, c.created_at asc
      limit ${limit}`;
    const results: any[] = [];
    for (const row of due as any[]) {
      if (!validCnpj(digits(row.tax_id))) {
        await sql`insert into public.client_registry_snapshots (client_id, source, tax_id, payload, fetched_at)
          values (${row.id}::uuid, 'monitor_erro', ${digits(row.tax_id)}, ${sql.json({ erro: "CNPJ_INVALIDO" })}, now())`;
        results.push({ ok: false, status: "CNPJ_INVALIDO" }); continue;
      }
      results.push(await checkOne(row));
      await sleep(1100);
    }
    const remaining = await sql`
      select count(*)::int n from public.clients c
      left join lateral (select max(case when s.source = 'monitor_falha' then s.fetched_at - interval '5 days' else s.fetched_at end) last from public.client_registry_snapshots s where s.client_id = c.id and s.source in ('monitor','monitor_erro','monitor_falha')) s on true
      where c.deleted_at is null and length(regexp_replace(coalesce(c.tax_id,''), '\\D', '', 'g')) = 14
        and (${orgFilter}::uuid is null or c.organization_id = ${orgFilter}::uuid)
        and (s.last is null or s.last < now() - make_interval(days => ${STALE_DAYS}::int))
        and not exists (select 1 from (select s2.payload ->> 'situacao' sit, s2.fetched_at from public.client_registry_snapshots s2
          where s2.client_id = c.id and s2.source = 'monitor' order by s2.fetched_at desc limit 1) z
          where z.sit = 'BAIXADA' and z.fetched_at > now() - interval '60 days')`;
    return json({ ok: true, checked: results.length, success: results.filter((r) => r.ok).length, changes: results.reduce((n, r) => n + (r.changes || 0), 0), irregular: results.filter((r) => r.irregular).length, remaining: remaining[0]?.n ?? 0 });
  } catch (e) {
    console.error("atlas-legalizacao-cnpj-monitor", e);
    return json({ error: "monitor_failed" }, 500);
  }
});
