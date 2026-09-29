# ATLAS LEGALIZAÇÃO E GERENCIAMENTO

Sistema interno para gestão de legalização empresarial.

## Produção

Esta branch é exclusiva do ATLAS Legalização:

`atlas-legalizacao-production`

O ATLAS CNPJ Explore continua na branch `main`.

## Funcionalidades ativas

- autenticação Supabase;
- perfis de acesso;
- administração de usuários;
- empresas;
- processos com etapas de legalização;
- edição e exclusão lógica de processos;
- dashboard com dados reais;
- relatórios com dados reais;
- consulta CNPJ;
- Supabase Storage privado;
- documentos vinculados a empresas e processos;
- Row Level Security;
- Edge Functions administrativas.

## Perfis

- Administrador
- Legalização / Operação
- Financeiro
- Auditoria
- Cliente

## Publicação Vercel

Nome recomendado:

`atlas-legalizacao-gerenciamento`

Production Branch:

`atlas-legalizacao-production`

Framework: **Other**

Root Directory: `./`

Deployment Protection / Vercel Authentication: **desativada** no projeto de produção.

A autenticação deve ser feita pelo próprio ATLAS/Supabase.

Consulte `DEPLOY-VERCEL.md` para a configuração completa.
