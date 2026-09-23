# ATLAS CNPJ.EXPLORE — Vercel

Esta versão já foi adaptada para a Vercel.

## O que mudou
- O servidor local Node foi substituído por Vercel Functions em `/api`.
- `/api/health` verifica o backend.
- `/api/cnpj/{cnpj}` é reescrito para a Function `/api/cnpj?cnpj={cnpj}`.
- O frontend permanece estático e responsivo.
- O PDF continua sendo gerado pela impressão do navegador.

## Configuração na Vercel
1. Crie/importe um projeto.
2. Framework Preset: **Other**.
3. Root Directory: raiz desta pasta.
4. Build Command: deixe vazio.
5. Output Directory: deixe vazio.
6. Node.js Version: **24.x**.
7. Deploy.

## Validação após publicar
1. Abra `https://SEU-DOMINIO.vercel.app/api/health`.
2. O retorno deve conter `"status":"ok"`.
3. Abra a página principal.
4. Consulte um CNPJ válido.
5. Teste “Imprimir / Salvar PDF” no desktop e no celular.

## Observação
A API pública CNPJws possui limitação de consultas. A Function envia cache de 10 minutos para respostas bem-sucedidas, reduzindo chamadas repetidas.
