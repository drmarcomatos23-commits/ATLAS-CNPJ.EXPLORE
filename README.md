# ATLAS CNPJ.EXPLORE

Sistema de consulta empresarial de CNPJ com dashboard responsivo, explorador de dados organizado e relatório para impressão/salvamento em PDF.

## Estrutura

- `index.html`, `app.js` e `styles.css`: interface web.
- `logo-atlas.png` e `favicon.svg`: identidade visual.
- `api/health.js`: verificação do backend.
- `api/cnpj.js`: proxy para a API pública CNPJws.
- `vercel.json`: configurações da Vercel, inclusive a rota `/api/cnpj/:cnpj`.
- `DEPLOY-VERCEL.md`: instruções para publicação.

## Publicação na Vercel

Importe este repositório no painel da Vercel, selecione o preset **Other** e mantenha os diretórios de origem e saída no padrão. O frontend é estático; as funções estão em `/api`.

Após o deploy, acesse `/api/health` e consulte um CNPJ válido. Para gerar o PDF, use **Imprimir / Salvar PDF** (função de impressão do navegador).

Atenção: a API pública CNPJws pode limitar a frequência de consultas. A publicação não representa uma integração oficial com a Receita Federal.
