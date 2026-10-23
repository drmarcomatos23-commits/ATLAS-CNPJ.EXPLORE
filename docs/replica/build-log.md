# Build log — ATLAS Social

## 22/10/2026 — etapa 1 (base + fatia principal)

- **Banco:** schema `social` no projeto Supabase ATLAS FAMILIA (15 tabelas, RLS em todas, acesso só para quem está em `social.member`). Nenhuma tabela do Atlas Família foi tocada (21 tabelas e lançamentos intactos, conferido após a migração). Token da Meta no Vault, lido só pelo servidor.
- **Base:** Next.js 15 + TypeScript 5 + Tailwind com os tokens do design (contraste verificado), navegação lateral no desktop e barra inferior no celular, login com o mesmo usuário do Atlas Família.
- S01 Conectar: OAuth do Facebook com proteção de estado, token de Página (não expira) guardado no Vault, primeira coleta automática.
- S02 Visão geral: 6 KPIs com comparação ao período anterior, gráfico diário, top 5 posts por seguidores ganhos, seguidores no tempo.
- S03 Posts: filtros (tipo, pilar, período), ordenação por qualquer métrica, coluna "seguidores por mil views". Cartões no celular, tabela no desktop.
- S04 Detalhe do post: curva desde a publicação, todas as métricas, escolha de pilar.
- S08 Melhor horário: mapa 7×24 e 3 melhores horários. Correção feita durante o teste: horário sem posts levava nota máxima; agora usa o desempenho médio (teste adicionado).
- S12/S13 Concorrentes: adicionar por @, comparativo com a sua conta, detalhe com evolução e posts de maior interação. Perfil pessoal é sinalizado. No celular virou cartões (a tabela cortava colunas).
- Telas S05, S06, S07, S09, S10, S11, S14, S15: rota criada com aviso de próxima etapa.
- **Coleta:** posts + métricas (2 anos), Stories (24 h), métricas diárias da conta (reprocessa 3 dias pelo atraso da Meta), seguidores online, público semanal, concorrentes diários. Pausa automática acima de 80 % do limite da API.

## Testes
- 10 testes unitários (métricas, ordenação, fuso de Brasília, melhor horário) passando.
- Build de produção e checagem de tipos sem erros.
- 8 telas × 2 tamanhos (390 px e 1440 px): sem erro no console, sem rolagem lateral; primeiro Tab leva ao "Pular para o conteúdo".
- Modo real: sem login, todas as telas redirecionam para /entrar; rota de coleta devolve 401 sem a chave.
- Isolamento do banco testado em Postgres local: dono vê os dados, outro usuário vê zero e não grava, anônimo bloqueado.

## A conferir com dados reais
- `online_followers`: confirmar em que fuso a Meta devolve as horas (o código assume horas contadas a partir do início do dia do período).
- `account_type`: a conexão grava "business"; se a conta for Creator, Story não poderá ser publicado pela API.

## Paridade (features.csv)
61 % do peso, 10 de 13 itens obrigatórios. Faltam: agenda (calendário), agendamento/publicação, e o agendamento horário da coleta (curva de 72 h e Stories).
