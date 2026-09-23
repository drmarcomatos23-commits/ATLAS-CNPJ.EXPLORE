# ATLAS CNPJ.EXPLORE · v4.1

Sistema responsivo para consulta de CNPJ, dashboard empresarial e relatório completo para impressão/PDF.

## Funcionalidades

- Consulta via API pública CNPJws, usando proxy Vercel em `/api/cnpj/:cnpj`.
- Explorador organizado em quatro abas: Dados da empresa, Estabelecimento, Sócios e Dados fiscais.
- Relatório A4 com informações, objetos e listas expandidos, incluindo CNAEs, sócios e inscrições estaduais.
- Layout claro e adaptado para desktop e celular.

## Publicação

O projeto está preparado para a Vercel (Framework: Other). As funções ficam em `/api`. Após publicar, verifique `/api/health`, consulte um CNPJ válido e confira o PDF.
