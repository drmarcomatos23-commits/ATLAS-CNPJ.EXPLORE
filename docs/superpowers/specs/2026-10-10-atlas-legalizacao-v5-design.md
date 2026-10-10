# ATLAS Legalização V5 — Especificação de Design

## Objetivo

Evoluir o ATLAS Legalização para uma V5 com visual mais profissional, consistente e comercial, preservando o funcionamento atual da V4 e sem alterar produção até validação final. A V5 deve reduzir a sensação de interface fragmentada, reforçar hierarquia visual e garantir comportamento consistente entre desktop e mobile.

## Restrições

- Não promover para produção durante o desenvolvimento.
- Não criar custos adicionais nem dependências pagas.
- Preservar Supabase, autenticação, regras de perfil e módulos funcionais existentes.
- Evitar refatorações de negócio que não sejam necessárias ao redesign.
- Manter compatibilidade com os fluxos atuais de Processos, Empresas, Licenças, Financeiro, Relatórios, Treinamento e Configurações.

## Problema atual identificado

A V4 possui múltiplas camadas concorrentes controlando o shell principal. `dashboard-v4.css`, `atlas-ui-v4.css` e `atlas-sidebar-v4.css` definem largura, posicionamento e margem da sidebar/workspace com valores divergentes e diversos `!important`. Isso produz comportamento inconsistente entre telas e breakpoints, especialmente na percepção de altura total da barra lateral e alinhamento do conteúdo.

## Estratégia escolhida

Criar uma camada V5 única, carregada por último, responsável pelo shell visual compartilhado. A implementação preservará os módulos funcionais existentes e migrará gradualmente apenas a apresentação.

### Alternativas consideradas

1. **Continuar acumulando overrides na V4** — menor esforço inicial, porém amplia conflitos de CSS e torna regressões mais prováveis.
2. **Reescrever toda a aplicação visual e funcional** — maior controle, porém risco desnecessário para autenticação, permissões e módulos maduros.
3. **Camada V5 de shell + modernização incremental dos módulos** — opção escolhida. Separa estrutura visual de regras de negócio e permite rollback simples.

## Arquitetura visual V5

### 1. Shell global

- Sidebar desktop fixa em altura total (`100dvh`) e visualmente contínua até o final da tela.
- Workspace com deslocamento definido por uma única variável de largura da sidebar.
- Topbar branca, limpa e consistente em todas as telas.
- Conteúdo central com largura fluida, espaçamento regular e fundo neutro.
- Rodapé legal fora do fluxo visual principal, sem interromper a sidebar.

### 2. Sidebar

- Largura desktop alvo: 208 px.
- Fundo azul-marinho corporativo.
- Logo com enquadramento estável e sem cortes.
- Grupos de navegação com espaçamento consistente.
- Item ativo com destaque discreto, sem excesso de efeitos.
- Navegação rolável quando a altura disponível for insuficiente, sem encurtar o fundo da barra.
- Footer institucional opcional ancorado ao final da sidebar quando houver espaço.

### 3. Dashboard

- Header contextual com título, resumo e filtros.
- KPIs em cards uniformes, com leitura rápida e sem excesso de cores.
- Bloco de operação/processos como conteúdo principal.
- Painel lateral de saúde operacional e alertas.
- Pipeline e pendências com hierarquia clara.
- Licenças críticas destacadas por prioridade, não por ornamentação.
- Tabelas com cabeçalho fixo visual e densidade equilibrada.

### 4. Empresa 360°

A tela deverá funcionar como visão consolidada da empresa, com seções claramente separadas:

- Identificação e dados cadastrais.
- Sócios e quadro societário.
- Processos ativos e concluídos.
- Licenças e vencimentos.
- Financeiro relacionado à empresa.
- Documentos.
- Histórico operacional.

A V5 manterá os dados e ações existentes, reorganizando-os em uma estrutura de navegação interna mais clara.

### 5. Workflow / Processos

- Lista e pipeline devem compartilhar a mesma linguagem visual.
- Filtros ficam em barra compacta e responsiva.
- Ações principais devem permanecer visíveis sem poluir cada linha.
- No mobile, cada processo vira card com campos prioritários e ações em largura total.

### 6. Mobile

- Sidebar passa a drawer sobreposto.
- Topbar sticky com botão de menu, ações essenciais e busca em linha própria.
- Inputs com pelo menos 16 px de fonte para evitar zoom automático no iOS.
- Cards em coluna única abaixo de 480 px.
- Tabelas críticas viram cards quando possível; quando não, rolagem horizontal controlada.
- Safe areas de iPhone respeitadas.

## Tokens V5

A camada V5 deve centralizar:

- largura da sidebar;
- cores de fundo, texto, borda e estados;
- radius padrão;
- sombra padrão;
- espaçamentos principais;
- altura de topbar;
- breakpoints.

Isso reduz a necessidade de `!important` e evita divergência entre módulos.

## Compatibilidade

A V5 não altera contratos de dados, tabelas do Supabase ou permissões nesta fase. Mudanças de DOM deverão preservar IDs usados pelos scripts atuais sempre que possível. Quando um ID precisar mudar, deve existir adaptação explícita no JS correspondente.

## Testes obrigatórios

1. Login e logout.
2. Navegação de todos os itens da sidebar.
3. Dashboard desktop em 1366 px e 1920 px.
4. Tablet em ~1024 px.
5. iPhone em 390–430 px.
6. Abertura e fechamento do menu mobile.
7. Processos em lista e pipeline.
8. Empresa 360° sem overflow horizontal.
9. Modais e formulários sem corte.
10. Persistência das funcionalidades existentes sem alterações de negócio.

## Critérios de aceite

- Sidebar ocupa visualmente toda a altura da tela no desktop.
- Não há sobreposição entre sidebar e workspace.
- Dashboard mantém alinhamento entre cards e painéis.
- Nenhuma tela principal apresenta overflow horizontal inesperado no mobile.
- Logo aparece corretamente em login, sidebar e relatórios existentes.
- A V5 pode ser revertida removendo sua camada de CSS/JS sem afetar os dados.
- Produção permanece inalterada até aprovação final.
