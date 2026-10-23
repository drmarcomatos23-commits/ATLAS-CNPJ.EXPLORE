export const metadata = { title: 'Privacidade' };
export default function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed">
      <h1 className="mb-4 text-lg font-semibold">Política de privacidade — ATLAS Social</h1>
      <p>O ATLAS Social é uma ferramenta de uso interno de Marco Matos Advogado para acompanhar métricas da própria conta do Instagram.</p>
      <p className="mt-3">Dados tratados: métricas da conta e dos posts próprios, fornecidas pela API oficial da Meta, e dados públicos de contas comerciais adicionadas como concorrentes. Não coletamos dados de seguidores individuais.</p>
      <p className="mt-3">Operadores: Supabase (banco de dados, São Paulo), Vercel (hospedagem) e Meta Platforms (origem dos dados). O token de acesso fica criptografado.</p>
      <p className="mt-3">Exclusão: ao desconectar a conta, todos os dados são apagados. Pedidos: dr.marcomatos23@gmail.com.</p>
    </main>
  );
}
