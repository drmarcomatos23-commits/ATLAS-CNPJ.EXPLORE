# ATLAS CNPJ.EXPLORE · v5.0.2

Consulta de dados cadastrais de empresas pelo CNPJ, dashboard responsivo e relatório completo para impressão/PDF.

## Funcionalidades

- Consulta individual de CNPJ pela API pública CNPJws, via função serverless da Vercel.
- Painel organizado em quatro categorias: Dados da empresa, Estabelecimento, Sócios e Dados fiscais.
- Relatório A4 com objetos e listas expandidos, incluindo CNAEs, sócios e inscrições estaduais.
- Identidade visual ATLAS e interface adaptada para computadores e celulares.

## Publicação na Vercel

Framework: **Other**. Root Directory: raiz do repositório. Node.js: **24.x**. Acesse `/api/health` para conferir o backend; depois consulte um CNPJ válido e teste a impressão/PDF.

O serviço público CNPJws possui limites de requisições. Informações cadastrais podem estar sujeitas à atualização; para comprovação, consulte os canais oficiais.

## Histórico de versões

- Backup da versão anterior à retirada da seção de filiais: branch `backup/atlas-v5-antes-remocao-filiais-20260923`.
- Backup da versão 5.0 original: branch `backup/atlas-v5-antes-integracoes-20260923`.
- Backup da versão 6.0 (fontes complementares): branch `backup/atlas-v6-antes-retorno-v5-20260923`.
