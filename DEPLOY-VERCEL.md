# ATLAS LEGALIZAÇÃO E GERENCIAMENTO — Produção Vercel

Esta branch é exclusiva do sistema **ATLAS Legalização e Gerenciamento**.

## Identidade do projeto

- Projeto Vercel: `atlas-legalizacao-gerenciamento`
- Repositório GitHub: `drmarcomatos23-commits/ATLAS-CNPJ.EXPLORE`
- Production Branch: `atlas-legalizacao-production`
- Framework Preset: **Other**
- Root Directory: `./`
- Build Command: vazio
- Output Directory: vazio

## Regra importante de acesso

O projeto deve ser acessível publicamente na Vercel.

Em **Settings → Deployment Protection**, deixe **Vercel Authentication desativada** para o projeto de produção.

A segurança de usuários é feita pelo próprio ATLAS por meio do **Supabase Auth**, com perfis, RLS e sessões individuais.

## Backend

O sistema usa:
- Supabase Auth;
- Supabase PostgreSQL;
- Row Level Security (RLS);
- Supabase Storage privado;
- Supabase Edge Functions;
- Vercel Functions para consulta CNPJ.

Não cadastrar OpenAI ou WhatsApp neste projeto neste momento.

## Validação pós-deploy

1. A página inicial deve abrir sem pedir login da Vercel.
2. O próprio ATLAS deve apresentar a tela de login.
3. Entrar com um usuário ATLAS.
4. Validar nome e perfil no cabeçalho.
5. Validar Empresas.
6. Validar Processos.
7. Validar Documentos/Storage.
8. Validar Integrações → CNPJ.
9. Validar Relatórios com dados reais.

## Recuperação de senha

Após definir o domínio definitivo, ele deve ser permitido nas URLs de redirecionamento do Supabase Auth para que o fluxo “Esqueci minha senha” retorne ao ATLAS.

Domínio esperado:

`https://atlas-legalizacao-gerenciamento.vercel.app`

## Separação

A branch `main` do repositório continua destinada ao ATLAS CNPJ Explore.

Não alterar a `main` ao publicar o Legalização.
