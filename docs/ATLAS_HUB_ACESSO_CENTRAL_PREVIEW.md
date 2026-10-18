# Atlas Hub — autorização central (somente preview)

**Esta branch não pode ser promovida para produção sem aprovação expressa.**

O arquivo `atlas-auth.js` foi ajustado somente nesta branch de testes: após autenticar o usuário e validar o perfil ativo, chama `atlas_hub_can_access('legalizacao')`. Qualquer falha/negativa bloqueia a interface. Não altera a autenticação do ambiente principal.

## Dependências de ativação
1. Revisar e testar a migração do diretório de permissões em banco isolado; a função SQL ainda NÃO está criada no banco atual.
2. Conciliar as contas existentes e conceder autorizações explícitas. Nunca habilitar acesso ao Contencioso por mera existência do login.
3. Adicionar verificação equivalente no backend do Contencioso antes de registrar responsáveis ou devolver processos.
4. O Atlas Hub será público antes da autenticação, mas listagem de usuários será reservada aos administradores autenticados.
5. Aplicar regras de autorização no servidor e revisar RLS das tabelas do Contencioso.
6. Testar negação de acesso via URL direta, perfis revogados, inativos, múltiplas organizações, autenticação, desktop e mobile.
7. Inspecionar o aviso do Supabase sobre 13 tabelas no schema `atlas_contencioso` com RLS desligada. **Não habilitar RLS indiscriminadamente**.

## Status
Código de login guard pronto nesta branch. Banco principal e projetos de produção preservados. Gerenciamento central efetivo dependerá da migração de esquema + integração de API.
