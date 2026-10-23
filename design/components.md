# Componentes — design system do clone

Fonte: Inter. Ícones: Tabler/Lucide. Cor de destaque (`accent`) é **provisória** — trocada na fase de marca (pode virar o azul-marinho e dourado do escritório).
Componentes só usam tokens (`tokens.css`); nada de hex solto. Contraste conferido em código: 32 pares, 0 falhas (`contrast-report.txt`).

## Layout
- **AppShell:** sidebar de 248 px no desktop; no celular vira barra inferior com 5 ícones (Visão geral, Posts, Agenda, Concorrentes, Mais). Conteúdo até 1280 px, margem lateral 16 px no celular.

## Primitivos

| Componente | Variantes | Estados | Tokens | Acessibilidade | Telas |
|---|---|---|---|---|---|
| Button | primary, secondary, ghost, danger · sm/md | default, hover, active, focus-visible, disabled, loading | accent, on-accent, border, radius-md | foco visível 2 px `focus`; loading com `aria-busy` | todas |
| Input / Textarea | — | default, focus, error, disabled | surface, border-input, danger | label sempre visível; erro em `aria-describedby` | S10, S12, S15 |
| Select / DateTime | — | idem | idem | teclado completo; fuso exibido junto | S03, S10, S14 |
| Badge de tipo | Reel, Carrossel, Imagem, Story | — | accent-soft + accent | texto, não só cor | S03, S09 |
| Badge de status | rascunho, agendado, publicando, publicado, falhou | — | text-muted / accent / success / danger | ícone + texto | S09, S10 |
| KPI Card | com/sem variação | carregando (skeleton), sem dados | surface, text, success/danger | variação lida como "subiu 12 %" | S02, S13 |
| Line Chart | 1–3 séries | vazio, carregando | accent, text-muted, border | tabela alternativa oculta para leitor de tela | S02, S04, S13 |
| Heatmap 7×24 | — | dados insuficientes (hachurado) | accent em 5 opacidades | cada célula com `aria-label` "terça 19h, nota 82" | S08 |
| Data Table | ordenável, com miniatura | vazio, carregando, paginação | surface, border, surface-2 (linha hover) | `aria-sort` nos cabeçalhos | S03, S05, S12 |
| Calendar | semana, mês | vazio, arrastando, conflito | surface-2, accent | navegação por setas | S09 |
| Post Card (agenda) | por tipo | por status | badges acima | arrastável com teclado | S09 |
| Media Uploader | 1 arquivo / até 20 | arrastando, enviando %, erro de formato | border-input, danger | botão alternativo ao arrastar | S10 |
| Alert / Banner | info, sucesso, aviso, erro | dispensável | accent-soft, success, warning, danger | `role="status"` ou `alert` | S01, S10, S15 |
| Modal | confirmação | — | surface, shadow-pop | foco preso, Esc fecha | S09, S12 |
| Empty State | por tela | — | text-muted | título + 1 frase + ação | todas |

## Próximo passo
Montar os primitivos isolados numa rota `/design` (shadcn/ui sobre Radix) e tirar print — fase de build (`replica-build`).
