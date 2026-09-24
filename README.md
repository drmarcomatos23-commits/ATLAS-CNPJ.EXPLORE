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


## Atlas 5.2 — Pesquisa histórica por pessoa
A seção adicional permite localizar **nomes empresariais e CNPJs** a partir de correspondências do nome do sócio no conjunto histórico `socios-brasil/socios` do Brasil.IO. Não dispara a consulta cadastral completa; o CNPJ é copiado manualmente e pesquisado no campo principal apenas se o usuário decidir.

**Configuração:** criar um token pessoal no Brasil.IO e cadastrar `BRASIL_IO_API_TOKEN` nas variáveis de ambiente da Vercel, sem prefixo `Token `. O servidor envia a credencial com o cabeçalho `Authorization: Token ...`. Sem token, a pesquisa informa indisponibilidade, mantendo a consulta CNPJ original.

**Limitações importantes:** dados capturados em **20/09/2020**, não atualizados em tempo real; CPF público parcialmente mascarado; correspondência nominal não comprova identidade ou participação atual. O resultado pode ser parcial, pois a primeira página de até 50 registros é exibida. Para comprovação jurídica, consulte QSA oficial e atos societários. Não há pesquisa reversa nacional atual gratuita garantida por essa integração.

**Segurança:** CPF opcional é usado apenas no servidor para comparar o padrão mascarado da fonte; não é enviado ao Brasil.IO nem incluído integralmente no PDF. Nunca colocar token no JavaScript cliente.
