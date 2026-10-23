# ATLAS Social

Métricas, concorrentes e (em breve) agendamento do Instagram @matos_advogado — clone do Metricool para uso próprio.

## Separação dos outros sistemas

- **Branch exclusiva:** `atlas-social-production`. Não tem nenhum arquivo do ATLAS CNPJ Explore nem do Legalização e não altera `main` nem `atlas-legalizacao-production`.
- **Banco:** projeto Supabase **ATLAS FAMILIA**, mas num schema próprio chamado `social`. As tabelas do Atlas Família (`public`) não são lidas nem alteradas. Só usuários cadastrados em `social.member` veem algo.
- **Deploy:** projeto Vercel próprio (não usar o projeto do Legalização).

## Colocar no ar

1. Supabase (ATLAS FAMILIA) → *Settings → Data API → Exposed schemas*: adicionar `social`.
2. Liberar seu usuário: `insert into social.member(user_id) select id from auth.users where email = 'SEU-EMAIL';`
3. Vercel → *Add New Project* → este repositório → **Production Branch: `atlas-social-production`**, Framework: Next.js.
4. Variáveis de ambiente: copiar de `.env.example` (`SUPABASE_SERVICE_ROLE_KEY` em *Supabase → Settings → API keys*; `CRON_SECRET` = texto aleatório longo).
5. Meta for Developers: criar app tipo *Business*, produto *Instagram API com login do Facebook*, URL de redirecionamento `https://SEU-DOMINIO/api/meta/oauth/callback`, política de privacidade `https://SEU-DOMINIO/privacidade`. Copiar App ID e App Secret para as variáveis.
6. Abrir o app → Mais → Conexão com o Instagram → Conectar.

Coleta horária (curva de 72 h e Stories): o plano grátis da Vercel só roda tarefas 1×/dia; a coleta horária será agendada pelo próprio Supabase (pg_cron) na próxima etapa.

## Desenvolvimento

```bash
npm install
SOCIAL_DEMO=1 npm run dev   # dados de demonstração, sem Supabase/Meta
npm test                    # testes das métricas e do melhor horário
```

Plano completo (mapeamento, arquitetura, design, matriz de funcionalidades, prints): `docs/replica/`.
