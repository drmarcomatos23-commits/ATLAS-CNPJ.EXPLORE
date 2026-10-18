# Atlas Hub — Controle de acesso, segunda etapa de homologação

**Somente branch de preview. Não publicar nem migrar o banco principal.**

## Verificações concluídas
- Backend Contencioso: verificações por usuário e permissão explícita antes de `ensureScope` (que atualiza responsáveis).
- UI do Hub: diretório com nome, e-mail, perfil, situação, origem a conciliar e botões de permissão; ações dependem de autenticação e RPC administrativa.
- SQL de homologação (arquivos no pacote da conversa): funções `atlas_hub_can_access`, `atlas_hub_admin_users_v2`, `atlas_hub_set_access`, default-deny e trilha de auditoria.
- Testes locais com mocks: **13 verificações Node.js + 4 larguras no Chromium** (320, 393, 768, 1440).
- O script `atlas-auth.js` desta branch continua verificando autorização `legalizacao` antes de abrir o Legalização.

## Segurança e pendências
- Nenhuma função SQL foi aplicada ao Supabase principal. Ainda não existe autorização central ativa para usuários reais.
- O aviso de 13 tabelas do schema `atlas_contencioso` sem RLS precisa ser avaliado, mas os papéis `anon` e `authenticated` **não têm USAGE do schema ou privilégio SELECT/UPDATE direto** na configuração atualmente inspecionada. A proteção da Edge Function continua obrigatória.
- Aplicar migracões em staging, identificar e reconciliar usuários existentes, adicionar o guard ao endpoint de preview do Contencioso, testar falhas/401/403, retomar SSO e só então aprovar produção.
- **Nunca** conceder Contencioso apenas pelo usuário ter conta no Legalização.
- Não transferir JWT por query string ou fragmentos de URL.
- Não habilitar RLS em lote sem políticas específicas e regressão.
