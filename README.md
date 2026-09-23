# ATLAS CNPJ.EXPLORE · v6.0

Dashboard empresarial responsivo para consulta de CNPJ e filiais, relatório A4 completo e **consultas complementares opcionais** com fontes públicas gratuitas.

## Backup antes desta alteração

Versão anterior preservada na branch `backup/atlas-v5-antes-integracoes-20260923`, criada antes de qualquer modificação da v6. O snapshot ZIP da v5 foi entregue ao usuário separadamente. Para recuperar, selecione essa branch no GitHub ou restaure os arquivos a partir do ZIP.

## Fontes complementares sob demanda

| Fonte | Consulta |
|---|---|
| Minha Receita | Dados cadastrais alternativos, comparação de razão social, situação, CEP, UF e capital social. |
| OpenCNPJ | Segunda fonte cadastral, com a mesma comparação. |
| ViaCEP | Verificação de município, UF e logradouro para o CEP registrado no CNPJ. |
| TCU | Consulta consolidada por CNPJ dos resultados dos cadastros do TCU, CNJ e CGU. |

**A consulta principal permanece na CNPJws.** Fontes complementares são chamadas *somente ao clicar em Consultar*. Suas informações não substituem automaticamente os dados cadastrais; cada retorno registra fonte e momento da consulta. Diferenças não demonstram irregularidade. Falha de consulta ou ausência de registro não atestam regularidade.

O relatório de impressão inclui apenas fontes efetivamente consultadas. O ATLAS não emite certidões oficiais: para validade documental, consulte os portais de origem.

## Matriz e filiais

Permanece a consulta individual gratuita de CNPJs conhecidos da mesma raiz. A descoberta automática pela raiz exige credencial comercial `CNPJWS_TOKEN` e **não está ativada nem é necessária** para os novos módulos.

## Vercel

Projeto estático, functions em `/api`, Node 24.x, Framework Other. Endpoints: `/api/health`, `/api/cnpj/:cnpj`, `/api/filial?cnpj=...`, `/api/filiais?raiz=...`, `/api/complementos?fonte=viacep&cep=01001000`, ou `fonte=minhareceita|opencnpj|tcu&cnpj=...`.

As fontes externas podem ficar indisponíveis ou bloquear tráfego serverless. O frontend informa o erro, sem inferir resultados. Verifique limite de cada provedor antes de uso intensivo.
