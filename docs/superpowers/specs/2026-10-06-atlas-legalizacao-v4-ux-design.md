# ATLAS Legalização 4.0 — Design de Evolução Operacional e UX

Data: 2026-10-06
Baseline de produção: commit `a6363e7cddf7293a41ab29d31c4d62342c768a63` (Produção 3.66)
Branch de backup: `backup-atlas-legalizacao-v3.66-2026-10-06`
Branch de trabalho: `atlas-legalizacao-v4-ux`

## 1. Objetivo

Evoluir o ATLAS Legalização de um sistema predominantemente cadastral/consultivo para um cockpit operacional de legalização, sem romper a arquitetura atual, o Supabase, o modelo de permissões, os fluxos financeiros, a base de conhecimento, treinamentos e as regras já implementadas.

Princípio central da versão 4.0:

> O sistema deve mostrar o que precisa ser feito, por quem e até quando — e não apenas onde o processo está.

## 2. Premissas e restrições

- Preservar a identidade visual institucional atual.
- Preservar a branch `atlas-legalizacao-production` sem alterações até validação da nova versão.
- Não alterar o schema de banco de dados sem necessidade comprovada.
- Reutilizar dados já existentes de processos, custos, licenças, clientes, responsáveis, prazos e status.
- Manter compatibilidade com perfis `admin`, `operacao`, `financeiro`, `cliente` e `auditoria`.
- Manter Supabase Auth/Postgres/Storage/RLS.
- Não remover recursos já publicados, inclusive cartilha, treinamentos, base de conhecimento, cadastro por CNPJ, sócios, licenças e financeiro.
- Priorizar evolução incremental por novos módulos de frontend/overrides, evitando reescrever arquivos legados extensos quando não for necessário.

## 3. Alternativas consideradas

### A. Reescrever toda a interface
Vantagem: arquitetura visual mais limpa no curto prazo.
Desvantagem: risco elevado de regressões em regras já estabilizadas, integrações e permissões.

### B. Criar uma aplicação paralela 4.0
Vantagem: isolamento total.
Desvantagem: duplicidade de manutenção, risco de divergência de dados e custo operacional maior.

### C. Evolução incremental sobre a produção atual — RECOMENDADA
Adicionar uma camada 4.0 de dashboard, navegação, indicadores, cards mobile e componentes operacionais, preservando os módulos existentes e o banco atual.

Essa abordagem reduz risco e permite homologação por preview antes de qualquer promoção para produção.

## 4. Escopo funcional

### 4.1 Dashboard 4.0
Criar um painel com indicadores acionáveis:

- Processos ativos
- Processos atrasados
- Pendências de cliente
- Licenças vencidas ou vencendo em até 30 dias
- Honorários a receber
- Taxas a pagar

Cada card deve ser clicável e levar a uma lista filtrada correspondente quando tecnicamente viável.

### 4.2 Minha Operação Hoje
Criar seção central com processos que exigem ação imediata.

Campos mínimos:

- prioridade
- processo
- empresa
- etapa
- prazo
- responsável
- status
- próxima ação

Ordenação sugerida:

1. atrasados
2. vencem hoje
3. vencem amanhã
4. prioridade alta
5. demais prazos

### 4.3 Saúde da Operação
Exibir:

- percentual no prazo
- percentual em atenção
- percentual atrasado
- tempo médio de processos concluídos
- gargalos por etapa quando houver dados suficientes

Sem inventar métricas: quando não houver base histórica suficiente, mostrar estado vazio informativo.

### 4.4 Processos — lista e pipeline
Manter o pipeline existente, mas acrescentar uma visão de lista operacional com:

- processo
- empresa
- tipo
- etapa
- responsável
- prazo
- status
- próxima ação

A visualização deve permitir alternância entre `Lista` e `Pipeline`.

### 4.5 Próxima ação
Adicionar conceito visual de próxima ação ao processo.

Na primeira fase, derivar a próxima ação dos campos já existentes sempre que possível. Se não houver campo persistente específico, exibir `Definir próxima ação` em vez de criar dados fictícios.

Uma migração de banco só será feita posteriormente se for necessário persistir esse dado de forma própria.

### 4.6 Timeline do processo
Aproveitar histórico/eventos já disponíveis. Exibir em ordem cronológica:

- mudanças de status
- alterações de etapa
- anexos
- pagamentos
- protocolos
- conclusão

Caso algum evento ainda não seja registrado no banco, o frontend não deve simular registros.

### 4.7 Central de Pendências
Criar agrupamento por origem da paralisação:

- Cliente
- Equipe
- Órgão
- Financeiro
- Licenças

O objetivo é indicar de quem depende o próximo avanço.

### 4.8 Central de Exigências
Fase 1: identificar processos com status/observações compatíveis com exigência/pendência e agrupá-los em painel próprio.

Fase 2 futura: criar entidade persistente de exigência se a operação exigir campos próprios como órgão, descrição, prazo e evidência.

### 4.9 Central de Licenças
Dashboard específico com grupos:

- vencidas
- até 30 dias
- 31 a 60 dias
- 61 a 90 dias
- regulares

Mostrar empresa, licença, vencimento, situação e acesso ao registro.

### 4.10 Dashboards por perfil

#### Administrador
Indicadores executivos, operação, financeiro, licenças, produtividade e gargalos.

#### Operação
Minha Operação Hoje, atrasos, pendências, processos, exigências e licenças.

#### Financeiro
Honorários a receber, taxas a pagar, vencimentos, pagos recentes e pendências financeiras.

#### Cliente
Manter visão restrita aos seus dados, sem revelar métricas internas.

#### Auditoria
Visão de consulta, rastreabilidade e indicadores sem ações de edição.

### 4.11 Pesquisa global
Evoluir a busca para localizar, em uma única consulta:

- empresas
- processos
- documentos
- licenças

Quando possível, agrupar resultados por categoria.

### 4.12 Navegação
Reorganizar sidebar por grupos visuais, preservando permissões:

- Visão Geral
- Operação
- Gestão
- ATLAS
- Administração

Não remover rotas existentes; apenas melhorar hierarquia e agrupamento.

## 5. Mobile

O projeto já possui cards mobile de processos na versão atual. A versão 4.0 deve preservar essa solução e estendê-la às novas áreas.

Regras:

- evitar tabela horizontal para o dashboard principal
- transformar listas operacionais em cards abaixo de 760 px
- manter ações com área de toque adequada
- evitar texto truncado crítico
- preservar menu lateral em drawer
- não exibir mais de quatro indicadores por bloco sem quebra responsiva

## 6. Design visual

Manter:

- azul-marinho como base institucional
- branco/cinza claro como superfície
- dourado como detalhe institucional

Cores semânticas:

- vermelho: atraso/vencido
- laranja: atenção
- amarelo: aguardando
- verde: concluído/regular
- azul: em andamento
- cinza: não iniciado/neutro

Evitar excesso de cores decorativas.

## 7. Arquitetura de implementação

Abordagem preferida:

- novo `dashboard-v4.js`
- novo `dashboard-v4.css`
- novo `operations-v4.js` para Minha Operação Hoje, saúde, pendências e agrupamentos
- atualizações pontuais em `index.html` para carregar os módulos e reorganizar navegação
- alterações pontuais em `mobile-responsive.css`
- reutilização de `loadOperationalData()`, `decorateProcesses()`, helpers de moeda/data, permissões e dados do Supabase
- evitar mudanças extensas em `legalizacao.js` quando um override modular puder resolver

Se durante implementação surgir uma dependência que exija schema novo, parar e documentar a migração antes de aplicá-la.

## 8. Estratégia de segurança e rollback

1. Produção 3.66 preservada em branch de backup.
2. Desenvolvimento apenas na branch `atlas-legalizacao-v4-ux`.
3. Preview Vercel antes de promoção.
4. Testar login e cada perfil.
5. Testar leitura e gravação existentes.
6. Testar mobile.
7. Somente após homologação, atualizar `atlas-legalizacao-production`.
8. Em caso de regressão, rollback para o deployment/commit 3.66.

## 9. Critérios de aceite

- Nenhum recurso existente deixa de funcionar.
- Dashboard passa a priorizar atrasos, pendências e próximos passos.
- Perfis veem somente dados e ações permitidos.
- Mobile não exige scroll horizontal nas novas áreas principais.
- Licenças vencidas/vencendo ficam claramente destacadas.
- Financeiro mantém dados de pagamento existentes.
- Processos continuam editáveis e concluídos continuam podendo ser reabertos/alterados conforme regra atual.
- Cartilha continua sendo emitida com a data do dia.
- Nenhum dado fictício é inserido no banco para preencher KPI ou timeline.

## 10. Fora de escopo nesta primeira entrega

- troca de banco de dados
- reconstrução de autenticação
- mudança de identidade visual completa
- integração paga com novos fornecedores
- criação de aplicativo nativo
- automações regulatórias que dependam de credenciais ainda não disponíveis

## 11. Sequência de entrega proposta

Fase 1 — Dashboard, Minha Operação Hoje, saúde e navegação.

Fase 2 — lista/pipeline de processos, próxima ação e central de pendências.

Fase 3 — licenças, exigências, pesquisa global e dashboards por perfil.

Fase 4 — refinamento mobile, QA, preview e promoção para produção.
