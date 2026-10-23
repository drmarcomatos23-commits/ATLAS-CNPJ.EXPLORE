# Replica · Arquitetura — clone do Metricool (uso próprio)

## 1. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| App web | Next.js (App Router) + TypeScript | Uma base só para telas e rotas de servidor; roda bem no celular |
| Estilo | Tailwind + tokens do design system | Componentes nunca usam cor solta |
| Banco | Postgres no **Supabase** | Você já tem o Supabase conectado aqui; RLS pronta |
| Auth do app | Supabase Auth (e-mail) | Só você entra |
| Tokens da Meta | Supabase Vault | Token criptografado, nunca em texto puro |
| Arquivos | Supabase Storage | A Meta exige URL pública da mídia → URL assinada curta na hora de publicar |
| Jobs | Supabase pg_cron + Edge Functions | Coleta e publicação sem servidor extra |
| Gráficos | Recharts | Linha, barra e heatmap simples |
| PDF | @react-pdf/renderer | Relatório mensal |
| E-mail | Resend | Aviso de falha na publicação |
| Hospedagem | Vercel | Deploy do Next.js |

Um banco, sem microsserviços. Custo esperado: plano grátis de Supabase/Vercel/Resend dá conta de uma conta.

## 2. Requisitos na Meta (antes de qualquer código)

1. Converter @matos_advogado para **conta Business** (Creator não publica Story pela API).
2. Ligar a conta a uma **Página do Facebook** (obrigatório para Business Discovery/concorrentes).
3. Criar app no Meta for Developers (tipo Business), produto "Instagram API com login do Facebook".
4. Permissões: `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
5. Manter o app em **modo desenvolvimento** com você como admin: funciona para a sua própria conta sem revisão da Meta.

## 3. Banco

Arquivo `schema.sql` (validado em Postgres 16: 14 tabelas, RLS em todas).
Regras: `owner_id` em toda tabela; `on delete cascade` a partir da conta; `unique` impede snapshot duplicado no mesmo dia; `idempotency_key` + `locked_at` impedem publicar o mesmo post duas vezes.

## 4. Rotas

| Método e caminho | O que faz | Quem | Entrada | Saída |
|---|---|---|---|---|
| GET /api/meta/oauth/start | Inicia login Facebook | dono | — | redirect |
| GET /api/meta/oauth/callback | Troca code por token longo, lista Páginas/IG | dono | code | conta salva |
| GET /api/overview | KPIs do período | dono | from, to | KPIs + série diária |
| GET /api/media | Lista posts com última métrica | dono | filtros, ordem, página | posts |
| GET /api/media/:id | Curva e métricas | dono | — | snapshots |
| PATCH /api/media/:id | Definir pilar/notas | dono | pillar | post |
| GET /api/best-times | Heatmap 7×24 | dono | — | matriz + top 3 horários |
| GET/POST/PATCH/DELETE /api/schedule | CRUD de agendamentos | dono | post + assets | agendamento |
| POST /api/schedule/:id/publish-now | Publicar agora | dono | — | status |
| GET/POST/DELETE /api/competitors | Gerenciar concorrentes | dono | username | concorrente (ou `not_supported`) |
| GET /api/competitors/compare | Comparativo | dono | ids, período | tabela |
| POST /api/reports | Gerar PDF do mês | dono | período | report id |

Toda rota confere `owner_id = auth.uid()` (RLS) — sem exceção.

## 5. Jobs (pg_cron)

| Job | Frequência | O que faz |
|---|---|---|
| publish-worker | a cada 1 min | Pega `scheduled` vencidos com `FOR UPDATE SKIP LOCKED`, cria contêiner, espera `FINISHED`, publica; até 5 tentativas com espera crescente |
| media-sync-recent | a cada hora | Posts < 72 h: snapshot (curva de views) |
| stories-capture | a cada hora | Stories ativos: grava métricas antes de expirar |
| media-sync-daily | 1×/dia 03:10 | Posts antigos: snapshot diário (até 2 anos) |
| account-daily | 1×/dia 03:20 | Métricas da conta do dia anterior + `online_followers` |
| audience-weekly | 1×/semana | Cidade, idade, gênero |
| competitors-daily | 1×/dia 04:00 | Business Discovery: seguidores, nº posts, últimos posts |
| token-check | 1×/dia | Avisa por e-mail se o token expira em < 7 dias |

## 6. Melhor horário (algoritmo)

Para cada dia da semana × hora local: `nota = 0,5 × online_followers normalizado (30 dias) + 0,5 × desempenho médio dos seus posts naquela janela (views normalizadas por seguidores na data)`. Mostra os 3 melhores e marca janelas com poucos dados como "sem dados suficientes".

## 7. Partes que mordem

- **Fuso:** gravar UTC, exibir America/Sao_Paulo (sem horário de verão desde 2019, mas usar a biblioteca de fuso mesmo assim).
- **Publicar duas vezes:** trava `locked_at` + estado `publishing` + checar `ig_media_id` antes de repetir.
- **Contêiner de vídeo:** processa de forma assíncrona; checar `status_code` até `FINISHED` antes de publicar; expira em 24 h.
- **Limite de publicação:** travar em 50/24 h no app e consultar `content_publishing_limit` antes de publicar.
- **Limite de chamadas:** ler o cabeçalho de uso da Meta e pausar jobs quando passar de 80 %.
- **Atraso de dados:** métricas da conta podem chegar com até 48 h de atraso → reprocessar os últimos 3 dias.
- **Métrica vazia:** a API devolve vazio em vez de 0 → gravar `null`, nunca 0.
- **Concorrente não suportado:** perfil pessoal → marcar `not_supported` e explicar na tela.
- **LGPD:** apagar conta remove tudo em cascata; tokens no Vault.

## 8. Ordem de construção

1. **Fatia vertical:** conectar conta (S01) → coletar posts e métricas → tabela de posts (S03) ordenável por seguidores ganhos.
2. Visão geral (S02) + histórico diário da conta + detalhe do post (S04).
3. Concorrentes (S12, S13) + coleta diária.
4. Melhor horário (S08) + público (S07).
5. Planejador e publicação (S09, S10) + worker + aviso de falha.
6. Stories (S06), Reels (S05), ideias (S11).
7. Relatório PDF (S14), checagem OAB no editor, configurações (S15).
