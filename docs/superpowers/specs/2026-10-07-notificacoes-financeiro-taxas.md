# Especificação — Notificações de taxas para o Financeiro

## Objetivo

Sempre que uma nova **Taxa Junta / Cartório** for cadastrada em um processo do ATLAS, todos os usuários ativos com perfil `financeiro` da mesma organização devem receber uma notificação interna no sistema, praticamente em tempo real, sem depender de e-mail ou serviços pagos.

## Escopo funcional

- Gatilho: criação de uma nova linha em `costs` que represente taxa de Junta/Cartório (`fee_kind = 'junta_cartorio'` ou `cost_type = 'registry_fee'`).
- Destinatários: todos os registros ativos de `profiles` com `role = 'financeiro'` e `organization_id` igual ao da taxa/processo.
- Conteúdo mínimo da notificação:
  - empresa;
  - processo / código público;
  - valor da taxa;
  - vencimento;
  - responsável pelo pagamento;
  - usuário que originou o lançamento, quando identificável;
  - data e hora do evento.
- O simples salvamento posterior do processo não deve gerar uma nova notificação para a mesma taxa.
- Alterações futuras no valor ou vencimento da taxa não fazem parte desta primeira versão; o evento inicial é apenas `taxa criada`.

## Persistência e segurança

Criar uma tabela `atlas_notifications` no Supabase com, no mínimo:

- `id uuid primary key`;
- `organization_id uuid not null`;
- `recipient_profile_id uuid not null references profiles(id)`;
- `event_type text not null` com valor inicial `fee_created`;
- `title text not null`;
- `body text not null`;
- `process_id uuid null references processes(id)`;
- `client_id uuid null references clients(id)`;
- `cost_id uuid null references costs(id)`;
- `metadata jsonb not null default '{}'`;
- `read_at timestamptz null`;
- `created_at timestamptz not null default now()`.

Criar restrição de unicidade por `(recipient_profile_id, event_type, cost_id)` para impedir duplicação.

RLS:

- o usuário autenticado só pode ler e marcar como lidas as próprias notificações;
- o acesso deve permanecer restrito à própria organização;
- usuários comuns não podem inserir notificações manualmente pelo cliente.

## Geração da notificação

A geração deve acontecer no banco, por trigger/função PostgreSQL após `INSERT` em `costs`, e não apenas no JavaScript do formulário.

Motivos:

1. cobre qualquer forma futura de criação de taxa;
2. não depende de o navegador permanecer aberto;
3. evita perda de evento após falha de rede na interface;
4. concentra deduplicação e isolamento por organização no banco.

A função deve resolver a organização pelo processo/cliente associado ao custo, consultar os perfis financeiros ativos dessa organização e inserir uma notificação para cada destinatário.

## Interface

O botão de sino já existente no `index.html` passa a ser funcional.

Criar `notifications-v4.js` e `notifications-v4.css` com estas responsabilidades:

- carregar notificações do perfil autenticado;
- mostrar contador de não lidas no sino;
- abrir um painel/dropdown com as notificações mais recentes;
- destacar notificações não lidas;
- permitir `Marcar como lida`;
- permitir `Marcar todas como lidas`;
- permitir `Abrir processo` quando houver `process_id`;
- assinar Supabase Realtime para novos registros destinados ao perfil atual;
- atualizar contador e painel sem recarregar a página.

## Comportamento visual

Exemplo de notificação:

**Nova taxa cadastrada**

`DEC ENGENHARIA INTEGRADA LTDA · LEG-2026-000019`

`Taxa Junta/Cartório: R$ 450,00 · vencimento 10/10/2026`

O sino deve exibir badge numérico quando houver itens não lidos. Em mobile, o painel deve ocupar a largura disponível sem overflow horizontal.

## Integração com o fluxo existente

O fluxo atual em `process-financial.js` já grava a Taxa Junta/Cartório na tabela `costs` com `cost_type = 'registry_fee'`, `fee_kind = 'junta_cartorio'` e `metadata.kind = 'registry_fee'`. A nova trigger deve reagir exatamente a esse `INSERT`, sem alterar o comportamento de `saveFinance()`.

`index.html` deve carregar os novos arquivos de notificações após `atlas-auth.js`, para que o perfil e o cliente Supabase já estejam disponíveis.

## Critérios de aceite

1. Ao cadastrar uma nova Taxa Junta/Cartório, cada usuário financeiro ativo da organização recebe exatamente uma notificação.
2. Usuário financeiro de outra organização não recebe nem consegue consultar a notificação.
3. Salvar novamente o processo sem criar uma nova linha de taxa não duplica a notificação.
4. O sino mostra a quantidade de notificações não lidas.
5. A notificação aparece em tempo real para um financeiro conectado.
6. O financeiro consegue marcar uma ou todas como lidas.
7. `Abrir processo` leva ao mesmo modal/tela de processo já existente.
8. Funciona em desktop e mobile.
9. Nenhum serviço pago ou API externa é necessário.
