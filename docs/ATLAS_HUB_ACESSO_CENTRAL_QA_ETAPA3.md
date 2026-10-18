# ATLAS HUB — ETAPA 3 / HOMOLOGAÇÃO DE PAPÉIS (NÃO PUBLICAR)

**Escopo:** integração de acesso central, preservando os layouts de Legalização e Contencioso. Nenhum banco de produção foi migrado.

## Preparado e validado
- Migração de homologação `003_separate_system_roles_STAGING_ONLY.sql`: coluna `system_role` isolada por sistema, `atlas_hub_set_system_role`, auditoria de mudanças e diretório `atlas_hub_admin_users_v3`.
- O Contencioso deve consultar **apenas** a permissão `contencioso`, retornando `systemRole: user | admin`, antes de `ensureScope`.
- O papel de administrador no Legalização **não implica** administração no Contencioso.
- Revogar o acesso também rebaixa o papel daquele sistema para `user`. Uma nova concessão não recupera privilégios antigos.
- O Hub deve exibir os dois sistemas publicamente; o cadastro de identidades não equivale à concessão de acesso.
- O diretório de usuários só pode retornar resultados após autenticação e verificação de privilégio administrativo, respeitando organização.
- As credenciais e RPCs do protótipo somente são ativadas com configuração **isolada de staging**; a base principal é recusada.

## Testes
- **30/30** casos Node.js de autorização e de revisão dos contratos.
- **6/6** cenários Playwright em navegador: 320, 393, 768 e 1440 pixels, anônimo e não autorizado.
- São testes locais com fixtures, **não** um E2E com banco real.

## Dependências para habilitar
1. Isolar o projeto Supabase de homologação; qualquer custo deverá ser autorizado previamente.
2. Aplicar 001/002/003 somente em staging, revisar o SQL e realizar teste de migração/rollback.
3. Conciliar `public.profiles`, `auth.users` e `atlas_contencioso.responsaveis` sem concessões automáticas.
4. Integrar e testar o backend do Contencioso com papel por sistema; não confiar apenas na interface.
5. Analisar RLS do esquema contencioso, mantendo API indisponível para não autorizados.
6. Disponibilizar preview e obter aprovação expressa antes de qualquer produção.

A branch de Legalização contém um guard que consulta `atlas_hub_can_access('legalizacao')` e falha fechado; a função ainda não foi criada no banco principal.
