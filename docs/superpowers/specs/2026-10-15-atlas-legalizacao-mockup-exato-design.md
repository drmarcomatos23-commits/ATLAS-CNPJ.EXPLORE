# ATLAS Legalização e Gerenciamento — Especificação do Mockup Final

**Data:** 15/10/2026  
**Branch de trabalho:** `atlas-legalizacao-v6-mockup-exato`  
**Base preservada:** `atlas-legalizacao-v5.1` — commit `5ffaea5e3a5ec9b63116058f37a4928597c3075e`  
**Produção:** bloqueada para esta etapa; nenhum promote/alias de produção poderá ser executado sem aprovação expressa de Marco Matos.

## 1. Objetivo

Preservar integralmente o Atlas Legalização e Gerenciamento funcional atual e substituir apenas sua camada de apresentação pela interface final aprovada, reproduzindo com máxima fidelidade o mockup de referência anexado em 15/10/2026.

O redesenho abrange Dashboard e módulos internos, sem alterar contratos de dados, autenticação, permissões, integrações, regras financeiras ou regras operacionais, salvo adaptação estritamente necessária para conectar os componentes visuais aos dados reais já existentes.

## 2. Restrições obrigatórias

- Trabalhar exclusivamente no Atlas Legalização e Gerenciamento.
- Não alterar Atlas Hub nem Atlas Contencioso.
- Não publicar nenhuma alteração em produção antes de aprovação expressa.
- Trabalhar em branch/preview isolado.
- Preservar todas as funcionalidades existentes.
- Não substituir dados reais por números ou registros fictícios.
- Não alterar autenticação, URLs de produção, Supabase ou regras de negócio sem necessidade comprovada.
- Não redesenhar, reinterpretar ou substituir o logo oficial.
- Preservar a possibilidade de rollback simples para a versão atual.

## 3. Estratégia técnica escolhida

### Camada V6 de apresentação, sem reescrita funcional

A aplicação atual possui grande volume de JavaScript funcional maduro e contratos de DOM já cobertos por testes. A estratégia será criar uma camada visual V6 carregada por último e, onde necessário, um renderer/adaptador específico do Dashboard que consome os mesmos dados e funções existentes.

Isso evita uma reescrita completa e reduz o risco sobre login, perfis, CNPJ, sócios, pipeline, licenças, financeiro, relatórios, cartilha, base de conhecimento, treinamentos e atualização em tempo real.

### Alternativas rejeitadas

1. **Continuar apenas adicionando overrides à V5 atual:** menor esforço inicial, porém não permite fidelidade suficiente ao mockup e amplia conflitos de CSS.
2. **Reescrever toda a aplicação:** permitiria controle visual total, mas cria risco desnecessário para funcionalidades já maduras e banco existente.
3. **Camada V6 de shell + Dashboard específico + padronização dos módulos internos:** opção escolhida, porque preserva o sistema e permite reprodução fiel do layout.

## 4. Referência visual e proporções

A referência aprovada possui resolução de 1672 × 941 px e deve orientar a proporção visual do desktop.

### Geometria alvo no desktop

- Sidebar visualmente equivalente a aproximadamente 300 px na referência.
- Topbar branca com altura aproximada de 74 px.
- Workspace inicia imediatamente após a sidebar, sem margem residual.
- Hero ocupa toda a largura útil do Dashboard e aproximadamente 265–300 px de altura visual antes da área de indicadores.
- Seis cards principais aparecem em uma única linha no desktop largo.
- Abaixo dos indicadores, grid principal com Pipeline ocupando aproximadamente dois terços e Processos Recentes aproximadamente um terço.
- Linha inferior com três blocos: Processos por Situação, Empresas por Tipo e Próximos Prazos.

Essas dimensões deverão ser responsivas, mantendo a mesma hierarquia e proporção perceptiva da referência em 1366, 1440, 1672 e 1920 px.

## 5. Identidade visual

Utilizar exclusivamente a marca oficial já existente no projeto.

Paleta obrigatória:

- azul-marinho profundo;
- azul institucional;
- ciano;
- laranja;
- branco;
- tons neutros claros apenas para superfícies, divisores e fundos de apoio.

O resultado deve ter aparência corporativa, empresarial, moderna e limpa, sem efeitos decorativos que não existam no mockup.

## 6. Shell global

### Sidebar

- Fundo azul-marinho escuro em altura total (`100dvh`).
- Logo oficial completo no topo.
- Menu principal na ordem:
  1. Dashboard
  2. Empresas
  3. Processos
  4. Licenças
  5. Documentos
  6. Financeiro
  7. Relatórios
  8. Configurações
- Funcionalidades adicionais atuais permanecem acessíveis, porém devem ser organizadas em área secundária/expansível sem comprometer a composição principal aprovada.
- Ícones lineares claros.
- Item ativo com fundo azul e barra lateral laranja/dourada.
- Bloco inferior com avatar/iniciais, nome do usuário, “Minha Conta” e botão “Sair”.
- Sidebar não deve terminar antes do final da viewport.

### Topbar

- Fundo branco.
- Busca principal com placeholder exato: `Buscar empresas, processos, documentos...`
- Ícone de notificações com badge quando houver alertas reais.
- Avatar do usuário.
- Nome do usuário.
- Identificação `ATLAS Legalização`.
- Controle de conta alinhado à direita.

## 7. Hero do Dashboard

O hero não será tratado como um banner genérico. Deve reproduzir a composição do mockup:

- fundo com edifícios corporativos envidraçados;
- overlay azul-marinho/azul que preserve contraste;
- logo oficial grande à esquerda;
- texto `BEM-VINDO AO`;
- título `ATLAS`;
- subtítulo `LEGALIZAÇÃO E GERENCIAMENTO`;
- linha laranja curta;
- texto: `Gestão empresarial completa, com abertura, alterações, licenças e regularização, em um só lugar.`;
- bloco vertical à direita com barra laranja e itens:
  - ABERTURA
  - ALTERAÇÕES
  - LICENÇAS
  - REGULARIZAÇÃO
  - GESTÃO EMPRESARIAL

A posição, escala, alinhamento, espaçamento e contraste devem seguir a referência aprovada.

## 8. Indicadores principais

Logo após o hero, exibir seis cards em linha no desktop:

1. Empresas
2. Processos em andamento
3. Licenças vencendo
4. Honorários (mês)
5. Pendências
6. Documentos

Cada card deve conter ícone, título, valor real, eventual tendência apenas quando calculável com dados existentes e ação contextual.

Nenhum número fictício poderá permanecer no preview de homologação funcional.

## 9. Pipeline de Processos

Título: `PIPELINE DE PROCESSOS`.

Etapas obrigatórias:

1. Consulta de Viabilidade
2. DBE / Receita Federal
3. Junta Comercial
4. Alvará Municipal
5. Licenças / Órgãos Reguladores
6. Pós-abertura / Regularização

Requisitos:

- contagem real por etapa;
- cada etapa clicável;
- filtro/rota para os processos daquela etapa;
- cores e chevrons visuais equivalentes ao mockup;
- preservar o mapeamento atual do workflow, fazendo apenas adaptação visual dos nomes quando necessário;
- abaixo de cada etapa, apresentar quantidade e indicador visual de volume/progresso quando os dados existentes permitirem.

## 10. Processos Recentes

Painel lateral com:

- empresa;
- tipo de processo;
- status;
- data da última atualização;
- acesso ao processo.

Ordenação por atualização mais recente, usando somente registros reais.

## 11. Blocos inferiores

### Processos por Situação

- gráfico de distribuição;
- Em andamento;
- Concluídos;
- Aguardando;
- Em análise;
- Cancelados;
- contagens e percentuais reais.

### Empresas por Tipo

- distribuição por natureza/tipo empresarial;
- gráfico equivalente à referência;
- dados reais dos cadastros existentes.

### Próximos Prazos

- licenças e obrigações próximas do vencimento;
- empresa;
- tipo da licença/obrigação;
- prazo/data;
- status;
- destaque visual por proximidade;
- usar as regras reais já existentes para licenças e vencimentos.

## 12. Módulos internos

As telas de Empresas, Processos, Licenças, Documentos, Financeiro, Relatórios e Configurações deverão utilizar o mesmo design system do Dashboard:

- mesma sidebar;
- mesma topbar;
- mesma tipografia;
- mesmos tokens de cor, raio, borda e sombra;
- cards coerentes;
- tabelas com cabeçalho, densidade e hierarquia equivalentes;
- filtros compactos;
- formulários consistentes;
- modais responsivos;
- estados de hover/focus/disabled/loading;
- mensagens de erro e sucesso padronizadas.

Funcionalidades adicionais atuais, como Exigências, Integrações, Base de Conhecimento, Treinamento e Usuários, permanecem disponíveis e também recebem o mesmo shell visual.

## 13. Regras funcionais preservadas

Devem continuar funcionando sem regressão:

- login e autenticação;
- perfis Admin, Operação, Financeiro e demais perfis existentes;
- permissões por usuário;
- cadastro de empresas;
- CNPJ com preenchimento automático;
- alerta de CNPJ duplicado;
- consulta de CEP;
- cadastro e sincronização de sócios;
- organização por grupos e filtros;
- processos e etapas;
- reabertura de processos concluídos;
- custos, taxas e honorários;
- botão `PAGO`, data e status automáticos;
- licenças e alertas de vencimento;
- data final das licenças;
- documentos e anexos;
- cartilha de conclusão com data do dia da emissão;
- relatórios gerais, por grupo e financeiros;
- base de conhecimento;
- treinamentos;
- atualização em tempo real.

## 14. Mobile

A versão mobile deve ser tratada como interface própria do mesmo sistema, não como mera compressão do desktop.

Requisitos:

- sidebar vira drawer;
- topbar permanece estável;
- busca não pode sobrepor conteúdo;
- cards empilham de forma previsível;
- pipeline permite leitura e interação sem corte;
- tabelas críticas viram cards ou usam scroll horizontal controlado;
- formulários ocupam largura útil e não ficam flutuando no meio da tela;
- barras de ação devem ser sticky apenas quando não cobrirem conteúdo;
- modais respeitam viewport e safe-area;
- inputs com pelo menos 16 px em iOS;
- nenhum overflow horizontal inesperado em 390–430 px.

## 15. Arquivos previstos

Preferencialmente criar arquivos isolados para minimizar risco:

- `atlas-v6.css` — tokens, shell, sidebar e topbar;
- `dashboard-v6.css` — hero, KPIs, pipeline e blocos do Dashboard;
- `dashboard-v6.js` — renderer/adaptador dos dados reais para a nova composição, apenas se necessário;
- `modules-v6.css` — padronização visual de módulos internos;
- `mobile-v6.css` — responsividade final;
- testes contratuais V6 em `tests/`.

O `index.html` será modificado apenas para carregar a camada V6 por último e preservar os IDs/classes necessários aos scripts atuais.

## 16. Testes obrigatórios

### Regressão funcional

1. Login e logout.
2. Perfis Admin, Operação e Financeiro.
3. Permissões por menu e ação.
4. Empresas: cadastro, edição, CNPJ, CEP, sócios, grupos.
5. Processos: criação, edição, pipeline, conclusão, reabertura.
6. Licenças: cadastro, vencimentos, alertas e datas.
7. Documentos/anexos.
8. Financeiro: custos, taxas, honorários, botão PAGO, data/status.
9. Relatórios.
10. Cartilha com data do dia.
11. Base de conhecimento e treinamentos.
12. Atualização em tempo real.

### Regressão visual

- Desktop: 1366, 1440, 1672 e 1920 px.
- Tablet: 1024 px.
- Mobile: 390, 412 e 430 px.
- Ausência de sobreposição, scroll lateral indevido e elementos fora da viewport.
- Comparação visual direta com o mockup aprovado para Dashboard.

## 17. Critérios de aceite

A etapa estará pronta para apresentação quando:

- o Dashboard reproduzir fielmente a referência aprovada;
- todos os indicadores estiverem ligados a dados reais;
- todos os módulos internos compartilharem a mesma identidade;
- todas as funcionalidades existentes permanecerem utilizáveis;
- testes automatizados estiverem passando;
- preview Vercel estiver `READY`;
- produção permanecer sem alteração causada por esta branch;
- o preview completo for apresentado a Marco Matos para aprovação.

## 18. Regra de publicação

Nenhuma etapa deste trabalho autoriza promoção para produção.

Somente após aprovação expressa do preview por Marco Matos poderá existir uma etapa separada de promoção/substituição da versão em produção.
