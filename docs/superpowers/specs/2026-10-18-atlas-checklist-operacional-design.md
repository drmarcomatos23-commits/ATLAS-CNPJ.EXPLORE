# ATLAS Legalização — Checklist documental operacional

Data: 18/10/2026

Status: **especificação para revisão do Dr. Marco Matos; implementação não autorizada nesta etapa**

Branch de desenho: `design/atlas-checklist-operacional-20261018`
Base: `preview/atlas-legalizacao-checklist-20261018`

## 1. Objetivo e decisões aprovadas

Substituir a relação documental meramente orientativa por controles operacionais por processo: requisitos específicos de cada serviço, situação e responsável de cada item, arquivos/protocolos vinculados, prazos, histórico auditável e indicadores de pendências por origem. O módulo deverá funcionar em desktop e celular, preservando o visual aprovado do ATLAS Legalização e os módulos já existentes.

Decisões da conversa de 18/10/2026:

1. A lista muda imediatamente conforme o serviço selecionado e é gravada no processo quando criado.
2. Pendências são identificadas por **cliente**, **financeiro**, **órgão público** ou **operação**, além de um usuário interno incumbido do acompanhamento.
3. Itens podem ser solicitados, recebidos, conferidos, aprovados, devolvidos ou dispensados, com documentação de suporte e histórico.
4. **Pendências geram alertas, nunca bloqueio automático de avanço de etapa.** A transição permanece uma escolha explícita do usuário autorizado.
5. Perfis: administrador com gestão integral; operação com documentos/protocolos; financeiro apenas no escopo financeiro; auditoria somente leitura; cliente sem acesso direto inicial.
6. Preservar produção, banco de produção, Atlas Hub e Atlas Contencioso. Trabalhar em branch/preview e não publicar nem executar migração de produção sem autorização expressa.

Essa regra de avanço **substitui, para esta funcionalidade, a exigência de bloqueio por pendências na proposta anterior da Central Operacional 7.1**. O indicador de prontidão pode dizer “incompleto”, mas a ação de avançar não será negada exclusivamente porque existem tarefas, documentos, exigências ou pagamentos pendentes.

## 2. Problema confirmado no código atual

- `atlas-ops-v7-docs.js` mostra `referenceChecklistHtml()` como texto quando `document_requirement_templates` não está disponível. Os itens provisórios não têm identidade persistente, checkbox, formulário, responsável ou vínculo com `processes`.
- `decorateNewProcessForm()` mostra um preview de modelos; a experiência não fornece seleção/aplicabilidade/estado real. O formulário de criação em `company-flow.js` usa um `select` de sete serviços; a edição legada em `legalizacao.js` usa entrada textual. Ambos devem trabalhar com a mesma tipagem e lógica reativa.
- A migração `20261017_atlas_v7_1_document_exigencies.sql` existe apenas como código-fonte e não foi aplicada ao banco de produção. O modelo atual prevê documento/revisão/exigência, mas não separa a situação documental de “pendente com” e mantém travas de transição por documento/exigência/tarefa.
- O preview Vercel anterior aponta para um ambiente cujo esquema de documentação não está disponível. Uma prévia com escrita não pode compartilhar inadvertidamente o banco de produção.

## 3. Abordagem arquitetural escolhida

**Extensão do checklist persistente por processo com consolidação de pendências entre módulos existentes.** Não criar um segundo cadastro de custos, protocolos ou arquivos.

| Domínio | Fonte primária dos dados | Interface integrada |
|---|---|---|
| Requisitos documentais | `document_requirement_templates`, `process_document_requirements` | Checklist do processo |
| Arquivos e versões | `documents`, Storage privado, `process_document_versions` | Anexo por requisito e dossiê |
| Pagamentos, taxas e honorários | `costs` e registros financeiros existentes | Resumo de pendências financeiras, com link para financeiro |
| Exigências formais e protocolos | `process_exigencies`, evidências e protocolos | Acompanhamento de órgãos com link para exigência |
| Tarefas e bloqueios existentes | `tasks`, `process_blockers` | Pendências internas e histórico já disponíveis |
| Auditoria | `process_document_events` e eventos dos módulos de origem | Histórico do processo |

Uma camada de **leitura agregada**, identificando `source_type` e `source_id`, forma os contadores/filtros sem duplicar registros modificáveis. Estado e evidência continuam na entidade de origem. Não introduzir novo motor global de tarefas.

## 4. Modelos e seleção por serviço

Serviços mapeados explicitamente: `abertura`, `alteracao_societaria`, `regularizacao`, `licenciamento`, `baixa`, `encerramento` e `legalizacao_empresarial`. Baixa e encerramento podem compartilhar requisitos iniciais, mas permanecem serviços distintos e configuráveis. Um valor legado/desconhecido deve mostrar aviso para configuração, não uma lista genérica apresentada como definitiva.

Cada modelo tem: `organization_id`, `service_type`, título, instruções, categoria, obrigatoriedade (`required`, `conditional`, `optional`), posição, ativo, etapa opcional, natureza jurídica opcional, UF/cidade opcional e condição de atividade/CNAE ou risco quando tecnicamente configurada. Condicionais não devem ser marcados como exigências universais; o usuário valida sua aplicabilidade no caso concreto.

Na **criação**:

1. O `select` de serviço dispara atualização da lista assim que muda, antes de qualquer consulta remota. A busca de modelos configurados confirma/refina o resultado. Requisições antigas não podem sobrescrever a seleção mais recente.
2. Mostrar quantidades, títulos, condicionais e possibilidade de incluir item manual e indicar “não se aplica”, conforme permissão. Preservar as escolhas do usuário enquanto muda somente cliente/etapa; mudança de serviço exige confirmação para descartar escolhas ainda não gravadas daquele formulário.
3. Depois de salvar o `processes.id`, inicializar os requisitos via operação idempotente no mesmo ambiente de dados. Evitar duplicatas por `(process_id, template_id)`; os itens são **cópias do modelo naquele momento** e não mudam silenciosamente quando o administrador edita um modelo futuro.
4. Se a criação do processo funcionar e a inicialização falhar, avisar explicitamente “processo salvo, checklist não gerado”, oferecer retomada segura e nunca afirmar sucesso documental. A nova tentativa não duplica requisitos.

Na **edição** do tipo de serviço de processo existente: apresentar proposta de reconciliação, adicionando os novos requisitos somente após confirmação, arquivando a aplicabilidade anterior sem apagar anexos, decisões ou eventos. Nunca excluir historicamente um item que já tenha movimentação.

## 5. Modelo de cada requisito documental

Campos mínimos da instância do processo:

| Campo | Semântica |
|---|---|
| `id`, `organization_id`, `process_id`, `template_id` | Identidade e vínculos reais |
| `title`, `instructions`, `category`, `required_rule`, `applicability` | Exigência do caso e aplicabilidade |
| `status` | Situação documental, distinta da origem de pendência |
| `pending_with` | `cliente`, `financeiro`, `orgao`, `operacao` ou nulo quando resolvida |
| `assigned_to` | Usuário interno que acompanha a pendência |
| `due_on`, `requested_at`, `received_at`, `resolved_at` | Prazo e marcos de movimentação |
| `document_id`, versões | Evidências ligadas ao mesmo processo e organização |
| `notes`, `waiver_reason`, `reviewed_by`, `reviewed_at` | Justificativas e conferência |
| `created_at`, `updated_at` | Auditoria e ordenação |

Estados canônicos e rótulos da UI:

| Estado | Rótulo | Condição de entrada |
|---|---|---|
| `not_requested` | Não solicitado | Modelo instanciado sem cobrança |
| `requested` | Solicitado | Registro de solicitação a responsável |
| `received` | Recebido | Documento anexado ou recebimento físico identificado e documentado |
| `in_review` | Em conferência | Revisão interna iniciada |
| `approved` | Aprovado | Conferência concluída por usuário autorizado e evidência vinculada |
| `returned` | Devolvido | Motivo obrigatório; retorna a uma pendência ativa |
| `waived` | Dispensado | Motivo obrigatório, usuário autorizado e histórico preservado |

Transições podem retornar a estado anterior quando houver correção/reabertura; todas exigem trilha imutável de `de -> para`, ator, data e justificativa quando aplicável. **Receber não equivale a aprovar.** A checagem visual “concluído” decorre somente de `approved` ou `waived`, não de um checkbox desconectado do processo.

Regras de integridade: documento e requisito devem pertencer à mesma organização e processo; um anexo não pode ser marcado aprovado em outro processo; dispensa não remove evidência; revisão não é feita pelo cliente; dados de órgãos dependem de protocolo/aceite informado, sem inventar confirmação externa.

## 6. Origem da pendência e responsabilidade

`pending_with` e `assigned_to` são independentes do `status` documental:

- Cliente: aguardando documento, informação ou assinatura. Pode haver cobrança interna, mas **não** contato automático por mensagem nesta primeira entrega.
- Financeiro: aguardando pagamento, autorização ou comprovante; operações financeiras continuam em `costs` e seus anexos, sem duplicação.
- Órgão público: protocolo, análise, deferimento ou resposta; estados oficiais/protocolos continuam em `process_exigencies`.
- Operação: preparo, revisão, complementação ou novo protocolo pela equipe.

Somente uma origem principal aparece por item em determinado momento; sucessivas transferências geram eventos. O histórico mantém quem era responsável antes. Quando não houver pendência ativa, `pending_with` pode ser nulo. Um `assigned_to` interno é distinto do ator externo com quem se aguarda resposta.

## 7. Interface proposta e experiência mobile

No modal de processo, a seção “Checklist documental” acompanha o serviço selecionado; inclui título, obrigatoriedade, aplicabilidade e previsão de responsáveis. Nenhum painel deve mostrar apenas parágrafos estáticos fingindo representar uma funcionalidade persistente.

Após a criação, aba **Documentos** dentro do processo:

1. Resumo: total, aprovados/dispensados, solicitados, em conferência, vencidos; atalhos “Cliente”, “Financeiro”, “Órgão”, “Operação”.
2. Filtros combináveis por situação, origem, responsável e prazo; busca por título.
3. Lista de itens em cartões compactos no celular, linhas densas no desktop; situação e pendência em chips separados. Cada item abre edição com status, responsável, data, observação, anexo e histórico.
4. Ações conforme permissão: solicitar, registrar recebimento, anexar, conferir, aprovar, devolver, dispensar, incluir item manual.
5. Links entre checklist, lançamento financeiro e exigência formal abrem o registro de origem. Não duplicar botões de upload sem vínculo claro.

Usar identidade visual existente do ATLAS, sem reinterpretação do mockup aprovado. No celular, controles e modal não devem ficar sob a barra fixa de ação nem obrigar rolagem horizontal; filtros podem virar painel expansível.

## 8. Permissões e segurança

| Papel | Pode fazer |
|---|---|
| `admin` | Administrar modelos, requisitos, situações, responsáveis, dispensas e auditoria |
| `operacao` | Criar/atualizar checklist, vincular documentos, conferir, registrar protocolos e pendências operacionais |
| `financeiro` | Ver pendências relacionadas e editar somente registros financeiros e seus comprovantes; **não** aprovar documento societário |
| `auditoria` | Ler documentos, estados e histórico, sem mutações |
| `cliente` | Sem acesso direto inicial ao checklist; eventual portal é fase futura |

Permissões granulares existentes do Atlas prevalecem sobre rótulo de papel. RLS em todas as tabelas expostas, com `organization_id = current_org_id()` e checagem de permissão apropriada para escrita. RPCs preferencialmente `SECURITY INVOKER`, verificando organização/processo e papel em servidor. Nunca usar `service_role` no cliente. Eventos imutáveis por gravação transacional/trigger, não por confiança em eventos emitidos apenas no navegador.

## 9. Alertas e avanço das etapas — sem bloqueio

As pendências alimentam contadores no processo, dashboard e relatórios operacionais. Avisos no aplicativo incluem “vencendo”, “vencido”, “aguardando cliente/financeiro/órgão/operação” e “documento devolvido”. Não há envio externo de e-mail/WhatsApp nesta versão.

Ao avançar etapa:

- Mostrar quadro de pendências abertas **informativo**; não desabilitar o botão por esse motivo.
- O usuário autorizado confirma a transição, que registra ator, data, etapa anterior/nova e fotografia dos contadores de pendências.
- Documentos, exigências, custos ou tarefas não concluídos permanecem nos módulos de origem com a mesma identidade e histórico; o avanço **não os aprova, cancela, encerra ou dispensa**.
- Direitos de acesso, existência do processo e integridade de dados continuam sendo validações obrigatórias. Falhas técnicas reais não devem ser ignoradas.
- Preservar medição de SLA e histórico; classificação de espera externa e eventual pausa do SLA continuam independentes do direito de avançar.

O procedimento antigo `atlas_v71_advance_stage` contém validações de bloqueio por tarefas/documentos/exigências. Quando a implementação for autorizada, essas condições deverão virar **avisos, não exceções SQL**, em conformidade com a decisão mais recente do usuário. A mudança necessita testes de regressão específicos para as transições.

## 10. Compatibilidade, migração e homologação

- A migração v7.1 existente será **revisada em arquivos SQL de código-fonte**, incluindo estados adicionais, responsabilidade por pendência, regras RLS, auditoria e transição não bloqueante. Não executá-la em produção nesta fase.
- Processos já existentes não serão alterados ou recadastrados em massa. Após uma migração de produção **separadamente aprovada**, o administrador poderá revisar e inicializar um checklist para cada processo legado, com operação idempotente.
- Ambiente de homologação precisa de banco separado, com registros **sintéticos**. O preview atual pode ler dados de produção; portanto **não habilitar escrita do novo checklist** nele enquanto estiver apontando para esse banco.
- Preferir ambiente local/isolado disponível sem custo adicional. Não criar instância paga, copiar dados pessoais de produção ou alterar proteção do preview sem autorização específica.
- Na ausência de banco isolado, pode-se apresentar mockup explicitamente identificado, porém **não** alegar que persistência multiusuário foi validada. A homologação real fica condicionada ao isolamento seguro.
- Nenhum deploy de produção, atualização de variáveis de produção, migração de produção ou alteração de Atlas Hub/Contencioso está autorizado.

## 11. Falhas e observabilidade

- Se os modelos não carregarem, informar o erro e permitir nova tentativa. Não substituir silenciosamente por guia genérico como se fosse checklist operacional.
- Se perder conexão durante atualização, não marcar sucesso nem alterar contadores localmente sem confirmação do banco. Permitir repetir a operação idempotente.
- Ao alternar serviços rapidamente, respostas antigas de API não podem sobrescrever itens de serviço posterior.
- Registrar erros e operações relevantes sem expor CPF, dados sensíveis ou chaves em logs de navegador.
- Usuário sem permissão deve ver leitura permitida e ações desabilitadas/ausentes; o servidor deve rejeitar escrita indevida.

## 12. Critérios de aceite e verificações obrigatórias

1. Selecionar sucessivamente os sete serviços no formulário; a relação de documentos muda imediatamente e mantém a escolha atual mesmo com consultas lentas.
2. Criar processo com checklist; fechar e reabrir em outra sessão de homologação e ver as mesmas instâncias, estados e arquivos.
3. Atualizar `not_requested -> requested -> received -> in_review -> approved`, voltar a `returned` com motivo, corrigir e aprovar; trilha e usuário preservados.
4. Dispensar item com justificativa e reabrir sem perder histórico.
5. Trocar `pending_with` entre cliente, financeiro, órgão e operação; o responsável interno e os indicadores se atualizam sem duplicidade.
6. Vincular arquivo ao requisito certo; rejeitar link entre processos ou organizações distintas; versões permanecem acessíveis.
7. Uma taxa pendente e uma exigência de órgão aparecem no resumo, mas continuam editáveis apenas no módulo de origem e sob sua permissão.
8. Avançar uma etapa contendo tarefas obrigatórias, documentos, pagamento e exigência abertos: a transição é permitida, os alertas permanecem e nenhum registro é automaticamente encerrado.
9. Alterar o serviço de processo existente: comparar alterações e preservar itens já movimentados/arquivados e seus anexos.
10. Validar administrador, operação, financeiro, auditoria e cliente com testes de RLS e de UI; nenhum papel obtém acesso de outro.
11. Conferir no celular modal, cartões, campos, barra fixa e filtros sem sobreposição.
12. Rodar testes automatizados completos; verificar os arquivos efetivamente servidos no preview e testar a persistência somente em banco isolado.

## 13. Fora do escopo desta entrega

- Portal do cliente com upload ou solicitações diretas.
- Integrações automáticas com Redesim/Junta/Prefeitura para interpretar deferimentos.
- Envio automático de WhatsApp, e-mail ou notificações externas.
- Motor único de tarefas substituindo `tasks`, `costs` e `process_exigencies`.
- Migração retroativa em massa sem análise individual e sem autorização.
- Publicação em produção.

## 14. Próximo marco de autorização

Após revisão e aprovação **desta especificação escrita**, criar plano de implementação detalhado e submeter o método de execução/homologação à aprovação. Só depois desenvolver, testar em isolamento e apresentar um preview funcional. Publicação e migração de produção exigem decisão expressa independente.
