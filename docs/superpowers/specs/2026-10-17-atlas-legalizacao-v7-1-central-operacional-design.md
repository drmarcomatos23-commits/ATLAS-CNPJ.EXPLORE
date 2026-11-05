# ATLAS Legalização 7.1 — Central Operacional

Data: 17/10/2026
Status: desenho aprovado em conversa; aguardando revisão final da especificação escrita
Branch: `atlas-legalizacao-v7-1-central-operacional-20261017`

## 1. Objetivo

Transformar o ATLAS Legalização de um sistema predominantemente registrador de processos em uma central operacional que conduza o trabalho diário, deixando claro, para cada processo, o que precisa ser feito, por quem, até quando, o que está bloqueando o avanço e qual é o impacto no SLA.

A versão 7.1 não substitui a estrutura atual. Ela adiciona uma camada operacional sobre `workflow_templates`, `workflow_stages` e `processes`, preservando compatibilidade com os processos existentes.

## 2. Princípios já aprovados

1. Um processo pode ter várias tarefas simultâneas.
2. Uma única tarefa ativa pode ser marcada como Próxima Ação Principal.
3. Tarefas podem nascer automaticamente por etapa e também manualmente.
4. Tarefas obrigatórias controlam a prontidão da etapa.
5. O Atlas não avança de etapa sozinho: o usuário confirma a transição.
6. O SLA operacional usa dias úteis.
7. O tempo total do processo usa dias corridos.
8. Bloqueios externos pausam o SLA interno, mas não o tempo total.
9. Uma tarefa pode ter responsável individual e/ou equipe/fila responsável.
10. Exceções administrativas são permitidas apenas com justificativa auditável.
11. Processos legados entram na 7.1 de forma controlada, sem migração automática em massa.

## 3. Arquitetura

A arquitetura escolhida é um motor operacional próprio do ATLAS, normalizado e acoplado ao processo por interfaces estáveis.

Base atual preservada:

`workflow_templates -> workflow_stages -> processes`

Nova camada operacional:

`task_templates -> tasks -> task_events`

`teams -> team_members`

`tasks -> task_dependencies`

`processes -> process_blockers -> sla_pauses`

`processes -> stage_transitions`

`business_calendar_holidays`

A responsabilidade de cada unidade deve ser clara:

- `task_templates`: define tarefas padrão por etapa/fluxo.
- `tasks`: registra tarefas reais de um processo.
- `task_events`: trilha imutável de eventos de tarefa.
- `teams`: filas operacionais.
- `team_members`: membros e vínculos de equipe.
- `task_dependencies`: dependências entre tarefas.
- `process_blockers`: impedimentos operacionais e histórico de bloqueio.
- `sla_pauses`: períodos em que o SLA interno fica suspenso.
- `stage_transitions`: histórico das mudanças de etapa e seus marcos temporais.
- `business_calendar_holidays`: feriados considerados no cálculo de dias úteis, com escopo e origem identificáveis.

## 4. Modelo de tarefa

Cada tarefa deve suportar, no mínimo:

- `id`
- `process_id`
- `stage_id`
- `task_template_id` opcional
- `title`
- `description`
- `origin` = `automatic` | `manual`
- `required` boolean
- `is_primary_action` boolean
- `assignee_id` opcional
- `team_id` opcional
- `priority`
- `status`
- `due_at`
- `started_at`
- `completed_at`
- `sla_days` opcional
- `created_by`
- `completed_by`
- `created_at`
- `updated_at`

Status permitidos:

- `pending`
- `in_progress`
- `waiting_client`
- `waiting_agency`
- `waiting_finance`
- `blocked`
- `completed`
- `cancelled`

Não deve haver status operacional livre em texto.

O estado de bloqueio não será mantido em um boolean independente. A fonte de verdade será a existência de bloqueio aberto em `process_blockers`. Quando o bloqueio estiver associado a uma tarefa, a alteração do status da tarefa e a abertura/encerramento do bloqueio devem ocorrer de forma consistente e auditável. O histórico deve registrar o status anterior para permitir retomada correta após o desbloqueio.

## 5. Próxima Ação Principal

Um processo pode ter múltiplas tarefas ativas, mas somente uma deve ser a Próxima Ação Principal.

Regras:

1. Apenas tarefas não concluídas e não canceladas são elegíveis.
2. Ao concluir a tarefa principal, o sistema procura tarefas elegíveis e sugere a próxima.
3. A troca não ocorre silenciosamente: deve existir confirmação ou registro claro da alteração.
4. Se uma tarefa depende de outra ainda aberta, ela não deve ser sugerida como próxima ação.
5. O painel do processo deve destacar a próxima ação acima das demais tarefas.
6. A unicidade da Próxima Ação Principal deve ser protegida também na camada de persistência, evitando duas tarefas principais ativas no mesmo processo.

## 6. Tarefas automáticas e manuais

### 6.1 Automáticas

Criadas a partir de `task_templates` quando o processo entra em uma etapa.

Um template pode definir:

- título e descrição;
- obrigatoriedade;
- prioridade padrão;
- fila/equipe padrão;
- SLA próprio opcional;
- dependências;
- ordem sugerida;
- elegibilidade para Próxima Ação Principal.

### 6.2 Manuais

Criadas por usuários autorizados para fatos extraordinários do caso concreto.

Devem registrar quem criou, quando, por que e se são obrigatórias ou opcionais.

Relatórios devem conseguir diferenciar tarefas originadas do fluxo padrão de tarefas excepcionais.

## 7. Dependências

Uma tarefa pode depender da conclusão de uma ou mais tarefas.

Exemplo:

`Preparar DBE -> Protocolar DBE -> Acompanhar DBE`

Tarefas futuras continuam visíveis, mas aparecem como aguardando dependência até os pré-requisitos serem satisfeitos.

A dependência não deve apagar a tarefa da visão do usuário.

## 8. Bloqueios

Bloqueio é uma entidade/evento próprio e não apenas um rótulo textual.

Tipos iniciais:

- cliente;
- órgão público;
- financeiro externo;
- terceiro;
- interno.

Campos mínimos:

- processo;
- tarefa relacionada opcional;
- tipo;
- motivo;
- status anterior da tarefa, quando aplicável;
- início;
- fim;
- criado por;
- encerrado por;
- observações.

Bloqueios externos podem pausar o SLA interno. Bloqueio interno, por padrão, não deve mascarar desempenho da equipe e não pausa SLA automaticamente.

Ao encerrar bloqueio de tarefa, o sistema retoma o status anterior válido, salvo escolha explícita do usuário por outro status permitido.

## 9. SLA

O sistema deve calcular e exibir simultaneamente:

1. Tempo total do processo — dias corridos.
2. SLA da etapa — dias úteis.
3. Tempo operacional interno — dias úteis, descontando pausas externas válidas.
4. Tempo bloqueado — separado por categoria.

Cada pausa de SLA precisa registrar:

- início;
- fim;
- motivo;
- tipo de bloqueio;
- responsável pela classificação;
- vínculo com bloqueio.

O calendário útil deve considerar fins de semana e os feriados cadastrados em `business_calendar_holidays`. A 7.1 deve permitir que a organização mantenha esse calendário de forma auditável; integrações automáticas com fontes externas de feriados ficam fora do escopo inicial.

## 10. Conclusão e avanço de etapa

Uma etapa somente fica “pronta para avanço” quando todas as tarefas obrigatórias ativas daquela etapa estiverem concluídas ou formalmente dispensadas por exceção autorizada.

Quando pronta, a interface mostra uma ação explícita semelhante a:

`Concluir etapa e avançar para DBE / Receita`

Ao confirmar:

1. registrar transição;
2. fechar medição de SLA da etapa anterior;
3. atualizar `processes.current_stage_id`;
4. iniciar medição da nova etapa;
5. gerar tarefas automáticas da nova etapa;
6. registrar evento de auditoria.

A transição e a geração das tarefas da nova etapa devem ser tratadas como uma unidade consistente: falha intermediária não pode deixar o processo em nova etapa sem suas tarefas obrigatórias.

### Exceção administrativa

Perfis autorizados podem forçar a transição com tarefa obrigatória pendente, desde que forneçam justificativa.

A justificativa deve ser registrada em histórico imutável.

## 11. Compatibilidade com processos legados

Não haverá geração retroativa em massa.

Para processo legado, a interface oferece:

`Ativar Central Operacional neste processo`

Fluxo:

1. identificar etapa atual;
2. localizar templates correspondentes;
3. apresentar tarefas propostas;
4. permitir revisão;
5. somente após confirmação criar tarefas e iniciar controle 7.1.

Isso evita duplicação e geração incorreta de pendências.

## 12. Central Operacional — visão global

A Central Operacional é distinta da tela interna de cada processo.

Deve consolidar toda a operação em uma visão executiva e acionável.

Blocos recomendados:

- Minhas tarefas hoje;
- tarefas atrasadas;
- processos fora do SLA;
- processos bloqueados;
- aguardando cliente;
- aguardando órgão;
- financeiro pendente;
- processos sem movimentação;
- carga por equipe;
- carga por responsável;
- próximas ações críticas;
- alertas de licenças e prazos.

Filtros:

- responsável;
- equipe;
- cliente;
- grupo econômico;
- serviço;
- etapa;
- status;
- prioridade;
- tipo de bloqueio;
- período;
- dentro/fora do SLA.

Cada indicador deve ser clicável e levar à lista filtrada correspondente.

## 13. Lista de processos

A lista deve evoluir para uma visão operacional, preservando filtros e navegação existentes.

Colunas prioritárias:

- processo;
- cliente/empresa;
- serviço;
- etapa atual;
- progresso;
- próxima ação;
- responsável;
- prazo/SLA;
- status;
- menu de ações.

Visualizações adicionais podem incluir Lista, Kanban e Calendário, desde que não eliminem a visualização atual.

## 14. Tela interna do processo

A tela individual do processo deve concentrar:

- identificação do processo;
- cliente e serviço;
- etapa atual;
- responsável;
- data de abertura;
- previsão;
- timeline de etapas;
- próxima ação principal;
- tarefas da etapa;
- bloqueio atual;
- SLA e tempos;
- documentos;
- histórico;
- ação de concluir etapa e avançar.

Abas previstas:

- Visão Geral;
- Tarefas;
- Bloqueios;
- SLA e Prazos;
- Documentos;
- Histórico.

## 15. Tela de tarefas

Deve permitir visão por:

- Minhas;
- Da equipe;
- Todas, conforme permissão.

Filtros mínimos:

- etapa;
- status;
- prioridade;
- responsável;
- equipe;
- prazo;
- cliente/processo.

Ações rápidas:

- iniciar;
- concluir;
- bloquear;
- atribuir/repassar;
- mudar prioridade;
- abrir processo relacionado.

## 16. Detalhe da tarefa

Deve mostrar:

- título e descrição;
- processo e etapa;
- responsável individual;
- equipe;
- prazo;
- prioridade;
- SLA;
- dependências;
- checklist;
- anexos;
- comentários;
- histórico;
- ações de bloqueio, reabertura e conclusão.

## 17. Calendário

O calendário deve consolidar:

- tarefas com prazo;
- SLAs críticos;
- vencimentos de licença;
- compromissos operacionais.

Visões previstas:

- mês;
- semana;
- dia.

## 18. Relatórios

A 7.1 deve preparar os dados para relatórios como:

- tempo médio por etapa;
- processos fora do SLA;
- aging por etapa;
- tempo bloqueado por causa;
- produtividade por usuário;
- produtividade por equipe;
- volume de tarefas automáticas versus manuais;
- gargalos recorrentes;
- processos sem atividade;
- taxa de conclusão no prazo.

Não é objetivo desta fase construir toda a camada avançada de BI; é objetivo garantir a captura correta dos dados necessários.

## 19. Navegação e identidade visual

A versão 7.1 deve preservar as rotas e os módulos existentes do ATLAS Legalização. Novas telas operacionais não podem remover, renomear de forma incompatível ou quebrar recursos atuais como Empresas/CNPJs, Licenças, Documentos, Financeiro, Relatórios, Integrações, Base de Conhecimento, Treinamento, Usuários e demais módulos já existentes.

A direção visual aprovada para as novas telas segue a identidade ATLAS Legalização:

- sidebar azul-marinho;
- área principal clara;
- logo oficial sem recriação ou reinterpretação;
- azul para ações e navegação operacional;
- dourado como acento institucional;
- verde, amarelo/laranja e vermelho para estados semânticos;
- cards claros, bordas sutis, cantos arredondados e hierarquia visual limpa;
- densidade compatível com uso profissional diário;
- comportamento responsivo específico para mobile.

Os mockups aprovados definem a organização conceitual das telas. Na implementação, o layout deve ser harmonizado com o sistema atual, sem descaracterizar a identidade já aprovada ou eliminar funcionalidades existentes.

## 20. Permissões

A versão 7.1 deve respeitar o modelo atual de autenticação e perfis.

Diretrizes:

- usuários comuns visualizam e alteram apenas o escopo permitido;
- equipe pode receber tarefas sem atribuição individual;
- gestores podem redistribuir tarefas e operar filas;
- administrador pode configurar templates, equipes, SLAs e exceções;
- transições forçadas exigem permissão específica e justificativa;
- o cliente, em futuro portal, não verá notas internas, produtividade ou financeiro administrativo.

RLS e políticas de banco devem ser desenhadas antes de qualquer migração produtiva.

## 21. Tratamento de erro e consistência

Requisitos:

- nenhuma transição de etapa deve deixar processo e tarefas em estados divergentes;
- geração de tarefas de etapa deve ser idempotente;
- duplo clique ou repetição de chamada não pode duplicar tarefas;
- conclusão de tarefa deve validar dependências e permissão;
- criação/encerramento de bloqueio deve manter SLA consistente;
- falhas de rede devem apresentar estado recuperável e não gerar falsa confirmação;
- operações críticas devem ser transacionais no banco quando aplicável.

## 22. Auditoria

Eventos relevantes devem ser rastreáveis:

- tarefa criada;
- tarefa atribuída;
- tarefa iniciada;
- prazo alterado;
- prioridade alterada;
- tarefa bloqueada/desbloqueada;
- tarefa concluída/reaberta;
- próxima ação alterada;
- etapa concluída;
- transição forçada;
- SLA pausado/retomado;
- ativação 7.1 em processo legado.

Histórico operacional não deve ser sobrescrito silenciosamente.

## 23. Mobile

Mobile não deve ser uma simples redução do desktop.

A prioridade da experiência móvel será “Meu Dia”, com:

- tarefas de hoje;
- tarefas atrasadas;
- processos críticos;
- bloqueios;
- documentos recebidos;
- licenças vencendo;
- ações rápidas.

Ações rápidas previstas:

- concluir tarefa;
- anexar documento;
- atualizar etapa;
- criar pendência;
- abrir processo.

## 24. Segurança e dados

- Não aplicar alterações no banco de produção durante desenvolvimento sem aprovação expressa.
- Migrar somente após revisão de schema, RLS, índices e dependências.
- Evitar `SECURITY DEFINER` desnecessário.
- Preservar segregação por organização.
- Não expor campos administrativos a futuros perfis de cliente.
- Manter compatibilidade com autenticação atual.

## 25. Estratégia de desenvolvimento

Todo desenvolvimento deve ocorrer em branch separada e preview.

Produção permanece intocada até aprovação expressa após demonstração.

Ordem recomendada:

1. contratos de domínio e testes;
2. modelo de dados/migration apenas em arquivo;
3. adapters/repository layer;
4. motor de tarefas;
5. cálculo de SLA;
6. bloqueios;
7. transição de etapa;
8. Central Operacional;
9. tela interna do processo;
10. tela de tarefas;
11. responsividade/mobile;
12. integração com dados reais em ambiente seguro;
13. preview;
14. validação funcional;
15. aprovação de eventual migração e produção.

## 26. Testes obrigatórios

A implementação seguirá TDD.

Cobertura mínima esperada:

- criação automática de tarefas por etapa;
- idempotência de geração;
- tarefas manuais;
- obrigatoriedade;
- próxima ação única;
- dependências;
- bloqueio externo;
- bloqueio interno;
- pausa/retomada de SLA;
- contagem de dias úteis e feriados configurados;
- conclusão de etapa;
- prevenção de avanço com pendência obrigatória;
- transição administrativa justificada;
- ativação de processo legado;
- permissões;
- recuperação de erro;
- mobile/overflow dos principais painéis;
- preservação das rotas e módulos existentes.

## 27. Fora de escopo da 7.1

Ficam para versões seguintes:

- Portal do Cliente completo;
- matriz regulatória inteligente;
- distribuição automática por capacidade;
- rentabilidade completa por processo;
- assistente de IA de controle operacional;
- automações externas complexas com órgãos públicos;
- BI avançado.

A 7.1 deve preparar arquitetura e dados para essas evoluções sem implementá-las prematuramente.

## 28. Critérios de aceite

A versão 7.1 será considerada pronta para preview quando:

1. um processo puder possuir várias tarefas simultâneas;
2. tarefas automáticas forem geradas por etapa sem duplicação;
3. tarefas manuais puderem ser adicionadas;
4. houver apenas uma Próxima Ação Principal por processo;
5. dependências forem respeitadas;
6. bloqueios puderem pausar SLA externo corretamente;
7. SLA interno e tempo total forem calculados separadamente;
8. tarefas obrigatórias impedirem avanço de etapa;
9. avanço exigir confirmação humana;
10. exceção administrativa exigir justificativa;
11. processos legados puderem aderir de forma controlada;
12. Central Operacional consolidar pendências reais;
13. tela individual mostrar tarefas, bloqueios, SLA e histórico;
14. experiência mobile estiver funcional;
15. rotas, autenticação, permissões e módulos existentes forem preservados;
16. testes automatizados relevantes passarem;
17. nenhuma alteração tiver sido publicada em produção sem aprovação expressa.
