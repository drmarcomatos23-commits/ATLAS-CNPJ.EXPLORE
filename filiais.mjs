/** Regras comuns de estabelecimento e filiais; sem consulta automática na API gratuita. */
export const justDigits = (value) => String(value ?? '').replace(/\D/g, '');
export function validCnpj(value) {
  const d = justDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (s,weights) => { const sum = [...s].reduce((acc,c,i) => acc + Number(c)*weights[i],0); return sum % 11 < 2 ? 0 : 11 - sum % 11; };
  const a = dv(d.slice(0,12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const b = dv(d.slice(0,12)+a, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return d.endsWith(String(a)+String(b));
}
export function normalizeBranchList(list, raiz, consultedCnpj) {
  if (!Array.isArray(list)) return [];
  const root = justDigits(raiz).slice(0,8);
  const consulted = justDigits(consultedCnpj);
  return [...new Set(list.map(v => justDigits(typeof v === 'string' ? v : (v?.cnpj ?? ''))))]
    .filter(cnpj => validCnpj(cnpj) && cnpj.startsWith(root) && cnpj !== consulted);
}
export function branchFromCnpj(data, expectedRoot) {
  const e = data?.estabelecimento ?? {};
  const cnpj = justDigits(e.cnpj ?? '');
  if (!validCnpj(cnpj) || cnpj.slice(0,8) !== justDigits(expectedRoot).slice(0,8)) throw new Error('O CNPJ consultado não pertence à mesma raiz.');
  const city = typeof e.cidade === 'object' ? e.cidade?.nome : e.cidade;
  const uf = typeof e.estado === 'object' ? e.estado?.sigla : e.estado;
  const street = [e.tipo_logradouro,e.logradouro].filter(Boolean).join(' ');
  const address = [[street,e.numero,e.complemento].filter(Boolean).join(', '),e.bairro, [city,uf].filter(Boolean).join(' / '), e.cep ? 'CEP '+e.cep : ''].filter(Boolean).join(' · ');
  const cleanCnae = item => item && typeof item === 'object' ? {codigo: String(item.id ?? ''),descricao:String(item.descricao ?? '')} : {codigo:'',descricao:''};
  return {
    cnpj, nomeFantasia: String(e.nome_fantasia || data.razao_social || 'Não informado'),
    situacao: String(e.situacao_cadastral || 'Não informada'), tipo: String(e.tipo || (cnpj.slice(8,12)==='0001' ? 'Matriz' : 'Não informado')),
    endereco:address || 'Endereço não informado', atividadePrincipal:cleanCnae(e.atividade_principal),
    atividadesSecundarias:Array.isArray(e.atividades_secundarias) ? e.atividades_secundarias.map(cleanCnae) : [],
    atualizadoEm: String(e.atualizado_em || data.atualizado_em || '')
  };
}
