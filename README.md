# ATLAS CNPJ.EXPLORE · v5

Consulta empresarial de CNPJ com dashboard responsivo, explorador de dados, relatório para impressão/PDF e módulo **Matriz e filiais**.

## Matriz e filiais

- Na consulta principal, exibe a raiz do CNPJ e a nova seção de estabelecimentos.
- **Sem custos adicionais obrigatórios:** com a API pública, é possível informar um CNPJ conhecido da mesma raiz e consultar seu endereço, situação e atividades (principal e secundárias). O ATLAS não afirma que uma empresa não tem filiais quando a fonte não disponibiliza uma listagem.
- **Descoberta automática opcional:** com uma credencial comercial CNPJws e acesso à consulta pela raiz, o ATLAS lista os CNPJs encontrados, com paginação. Clique em *Ver dados* em cada unidade para consultar endereço e CNAEs.
- O PDF mostra unidades consultadas e marca as que ainda não tiveram os detalhes verificados.

**Importante:** a API pública não oferece listagem completa pela raiz. A integração comercial pode depender de plano e contabilizar requisições. O token é armazenado apenas no backend.

## Ativar descoberta automática, caso possua credencial CNPJws

No painel da Vercel: **Project → Settings → Environment Variables**, crie a variável `CNPJWS_TOKEN`, cole o token comercial e aplique ao ambiente de produção. Depois faça **Redeploy**. Não coloque o token nos arquivos do GitHub nem no navegador.

Endpoints: `/api/health`, `/api/cnpj/:cnpj`, `/api/filiais?raiz=12345678&page=1`, `/api/filial?cnpj=12345678000195`.

## Publicação

O projeto utiliza frontend estático e funções serverless da Vercel (Framework: Other). Teste uma consulta de CNPJ válido, os dados da filial, a impressão em PDF e o layout no celular.
