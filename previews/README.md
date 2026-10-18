# ATLAS Legalização v7.2 — Preview seguro

Abra `atlas-checklist-operacional.html` em um navegador para testar a experiência visual em desktop ou celular.

## O que este preview demonstra

- Sete serviços, cada um com uma lista documental diferente.
- Atualização simulada de situação, pendência com cliente/financeiro/órgão/operação, responsável, prazo, observações e comprovante (apenas o nome do arquivo, nunca upload).
- Busca e filtros de situação e origem, indicadores e painel de pendências por fonte.
- Avanço de etapa mediante confirmação, **sem bloquear ou concluir automaticamente** documentos, custos ou exigências.

## Limites e segurança

- **Demonstração sem gravação**: todos os dados são fictícios e mantidos somente na memória desta página. Atualizar a aba reinicia a simulação.
- O HTML não carrega autenticação, Supabase, serviços remotos nem scripts externos; não acessa produção.
- O código funcional e a migração versionada estão na branch local `feat/atlas-checklist-operacional-v72`; a persistência real **ainda exige validação em PostgreSQL de homologação** antes de qualquer avaliação de implantação.
- Nenhuma migração de produção nem publicação foi executada.
