# Replica · Recon — clone do Metricool (uso próprio, @matos_advogado)

Data: 22/10/2026 · Escopo aprovado: **uso só no próprio Instagram**, versão **completa com concorrentes**.
Plataforma: **web responsiva** (abre bem no celular). Público: o próprio Marco.

## 1. Núcleo (core loop)

Publicar → medir cada post (views, alcance, salvamentos, compartilhamentos, **seguidores ganhos**) → comparar com concorrentes → escolher o próximo tema e horário → agendar.

O que o Metricool cobra para entregar: histórico ilimitado (o Instagram apaga métricas da conta após 90 dias), concorrentes, melhor horário e relatórios.

## 2. Fontes (todas públicas)

| Fonte | URL | Para quê |
|---|---|---|
| Página de estatísticas do Instagram (Metricool) | https://metricool.com/instagram-statistics | Telas de métricas, seguidores ganhos por post, concorrentes, relatório |
| Landing para social media | https://metricool.com/landing-ads-social-media-managers/ | Melhor horário, biblioteca de posts, até 100 concorrentes, histórico ilimitado |
| Tools to manage Instagram | https://metricool.com/tools-to-manage-instagram/ | Hashtags, benchmarking, áudio em alta |
| G2 (avaliações) | https://g2.com/products/metricool/reviews | O que usuários elogiam e reclamam |
| Preços 2026 | https://www.upload-post.com/metricool-pricing/ | Free / Starter €16 / Advanced €43; API só no Advanced |
| Meta — Content Publishing | https://developers.facebook.com/docs/instagram-platform/content-publishing | Limites e fluxo de publicação |
| Meta — Media Insights | https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights | Métricas por post |
| Meta — Account Insights | https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights | Métricas da conta, público, horário online |
| Meta — Business Discovery | https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery | Dados públicos de concorrentes |
| Meta — Insights (guia) | https://developers.facebook.com/docs/instagram-platform/insights | Retenção: conta 90 dias, posts 2 anos |

## 3. Fatos da API que mandam no projeto

- **Concorrentes:** o endpoint Business Discovery devolve seguidores, nº de posts e, por post, curtidas, comentários e views — **só de contas Business ou Creator públicas**. Exige o login via **Facebook** (conta do Instagram ligada a uma Página do Facebook). Não dá alcance, salvamentos nem lista de seguidores do concorrente.
- **Publicação:** imagem, vídeo/Reel, carrossel e Story. O limite documentado hoje é **100 posts por 24 h** (algumas páginas ainda dizem 50; vamos travar em 50 por segurança). Carrossel conta como 1. Story só para conta **Business** (Creator não publica Story pela API). Contêiner expira em 24 h.
- **Métricas de post:** views, reach, saved, shares, follows, total_interactions; ficam disponíveis por **2 anos**. Stories: só por **24 h** → precisamos capturar de hora em hora.
- **Métricas da conta:** guardadas pela Meta só por **90 dias** → gravamos diariamente no nosso banco (é isso que dá "histórico ilimitado"). `online_followers` só dos últimos 30 dias e exige ≥100 seguidores (você tem 408 ✔). Dados podem atrasar até 48 h.
- **Removidas pela Meta:** impressions, profile_views, website_clicks, video_views. Substitutos: `views` e `profile_links_taps`.

## 4. Telas (S)

| ID | Tela | Rota | Propósito | Componentes | Estados |
|---|---|---|---|---|---|
| S01 | Conectar conta | /conectar | Login Facebook, escolher conta IG | Botão OAuth, checklist de requisitos | vazio, erro de permissão, conta Creator (aviso Story) |
| S02 | Visão geral | / | Resumo do período | KPI cards, gráfico de linha, top 5 posts | carregando, sem dados (<48 h) |
| S03 | Posts | /posts | Tabela de todos os posts | Filtros (tipo, período, pilar), tabela ordenável, miniaturas | vazio, filtrado, paginação |
| S04 | Detalhe do post | /posts/[id] | Curva de views nas 1as 72 h, métricas | Gráfico, métricas, notas | métricas indisponíveis (carrossel filho) |
| S05 | Reels | /reels | Retenção e pulos | Tabela + skip rate, tempo médio | — |
| S06 | Stories | /stories | Stories capturados antes de sumir | Grade, métricas | <5 views (Meta não retorna) |
| S07 | Público | /publico | Cidade, idade, gênero | Barras, mapa simples | <100 seguidores |
| S08 | Melhor horário | /horarios | Heatmap dia × hora | Heatmap, legenda | dados insuficientes |
| S09 | Planejador | /agenda | Calendário semana/mês | Calendário, cards de post, arrastar | vazio, conflito de horário |
| S10 | Editor de post | /agenda/novo | Criar/editar agendamento | Upload, legenda, tipo, data/hora, prévia, sugestão de horário | erro de mídia, limite diário |
| S11 | Ideias | /ideias | Biblioteca de rascunhos e temas | Lista, tags de pilar | vazio |
| S12 | Concorrentes | /concorrentes | Lista e comparação | Adicionar @, tabela comparativa | perfil pessoal/privado (não suportado) |
| S13 | Detalhe do concorrente | /concorrentes/[id] | Evolução e top posts | Gráfico seguidores, frequência, top posts | — |
| S14 | Relatórios | /relatorios | PDF mensal | Seletor de período, prévia, baixar | gerando |
| S15 | Configurações | /config | Token, fuso, notificações | Formulário | token expirando |

## 5. Fluxos (F)

- **F01 Conectar:** S01 → Facebook → escolher Página/IG → S02. Cliques no caminho feliz: **4**. Borda: conta sem Página ligada; permissões negadas.
- **F02 "Qual post trouxe seguidor?":** S02 → S03 (ordenar por follows) → S04. **3 cliques.**
- **F03 Agendar:** S09 → S10 (upload, legenda, aceitar horário sugerido) → salvar. **5 cliques.** Bordas: vídeo fora do padrão, limite diário, token expirado na hora de publicar.
- **F04 Comparar concorrente:** S12 → digitar @ → adicionar → S13. **3 cliques.** Borda: perfil pessoal (Meta não retorna).
- **F05 Relatório mensal:** S14 → mês → baixar PDF. **3 cliques.**
- **F06 Melhor horário:** S08 ou sugestão automática dentro do S10.

## 6. Componentes repetidos

KPI card (valor, variação %, período) · gráfico de linha · heatmap · tabela ordenável com miniatura · card de post no calendário (status: rascunho, agendado, publicando, publicado, falhou) · seletor de período · badge de tipo (Reel, Carrossel, Imagem, Story) · aviso/alerta · modal de confirmação.

## 7. Modelo de dados inferido

| Entidade | Campos principais | Evidência | Confiança |
|---|---|---|---|
| Conta IG | ig_user_id, username, tipo (business/creator), token | API | alta |
| Métrica diária da conta | data, seguidores, views, reach, profile_links_taps | API (90 dias) | alta |
| Post (mídia) | ig_media_id, tipo, legenda, permalink, publicado_em, pilar | API | alta |
| Snapshot de métricas do post | coletado_em, views, reach, saved, shares, follows, interações | API | alta |
| Story | igual post, janela 24 h | API | alta |
| Público | dimensão, chave, valor, data | API | alta |
| Seguidores online por hora | data, hora, valor | API | alta |
| Concorrente | username, seguidores, nº posts | Business Discovery | alta |
| Post do concorrente | curtidas, comentários, views, publicado_em | Business Discovery | média (views nem sempre vêm) |
| Agendamento | mídia, legenda, tipo, horário, status, tentativas | Metricool planner | alta |
| Ideia | título, pilar, notas | biblioteca do Metricool | média |
| Relatório | período, arquivo | Metricool reports | alta |

## 8. O que NÃO dá para clonar (skip)

| Item | Motivo |
|---|---|
| Escolher música/áudio em alta no Reel | API de publicação não permite trilhas do Instagram |
| Stickers, enquetes, links em Story | Não suportado pela API |
| Marcação de conteúdo de marca | API não suporta |
| Alcance, salvamentos e seguidores ganhos do concorrente | Dado privado do concorrente |
| Concorrente com perfil pessoal ou privado | Business Discovery só lê Business/Creator |
| Lista de seguidores (seus ou de terceiros) | API não expõe |
| Outras redes, anúncios, marca/logo Metricool | Fora do escopo / marca de terceiro |

## 9. Tamanho

**M — algumas semanas.** As três partes mais difíceis:
1. Aprovação de acesso na Meta: app em modo desenvolvimento serve para a sua própria conta, sem revisão, mas exige conta Business ligada a uma Página do Facebook.
2. Publicação agendada confiável: upload de vídeo, contêiner que expira, repetir sem publicar duas vezes.
3. Captura contínua (Stories em 24 h, métricas de conta que somem em 90 dias) sem estourar limites da API.
