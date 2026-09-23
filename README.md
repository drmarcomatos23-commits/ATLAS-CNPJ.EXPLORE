# ATLAS CNPJ.EXPLORE · v4

Painel responsivo para consulta CNPJ com a API pública CNPJws, explorador empresarial em quatro abas, relatório completo para impressão/salvamento como PDF e orientação para conferência municipal.

## Funcionalidades

- Consulta de CNPJ via `/api/cnpj/:cnpj` (proxy Vercel), com tratamento de erros.
- Dashboard e explorador de dados sem exibir código JSON.
- Relatório A4 com **todos os objetos e listas expandidos**, incluindo CNAEs, QSA e inscrições estaduais.
- Cabeçalho adaptado para celular.
- Seção de **inscrição municipal e alvará**: atalhos para os portais oficiais de Santos/SP, preenchimento de números/datas e declaração opcional de conferência **manual**. Os dados municipais não são disponibilizados pela CNPJws; o aplicativo não confirma sua existência, validade ou autenticidade automaticamente.

## Publicação

O repositório está configurado para a Vercel (Framework: Other, raiz `./`). Quando o GitHub estiver conectado à Vercel, commits na branch principal poderão disparar uma nova publicação.

Verificação: `/api/health` → `status: ok`. Após publicar, consulte um CNPJ válido, teste o relatório e a visualização mobile.

**Atenção:** não insira senhas, código de acesso da prefeitura ou CAPTCHA nos campos complementares. Para documentos municipais, confira as informações no sistema do município competente.
