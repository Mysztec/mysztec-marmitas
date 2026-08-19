# Mysztec Marmitas

Sistema de controle de reserva e retirada de marmitas corporativas, usado para
organizar o almoço de funcionários distribuídos em múltiplas unidades (barracões).

O sistema nasceu numa plataforma low-code (Base44) e foi **migrado para uma stack
própria**, sem dependência de plataforma. Este repositório é o resultado dessa
migração — a seção [Migração](#migração-de-plataforma-low-code-para-stack-própria)
descreve como ela foi feita e por quê.

---

## O problema

Uma empresa com várias unidades precisa saber, todo dia:

- quem vai almoçar (para encomendar a quantidade certa ao restaurante);
- quem realmente retirou a marmita (para cobrar quem reservou e não retirou);
- quanto cobrar de cada funcionário no fim do mês.

Fazer isso em papel ou planilha gera erro de contagem, desperdício de comida e
discussão na hora de fechar a conta.

## A solução

O dia opera em **fases automáticas**, definidas por horário:

| Fase | Janela | O que acontece |
|---|---|---|
| `reserve` | 07:00–10:00 | Funcionário reserva a marmita digitando o PIN |
| `waiting` | 10:00–11:00 | Janela fechada; pedido já foi enviado ao restaurante |
| `pickup` | 11:00–13:30 | Funcionário confirma a retirada com o PIN |
| `done` | após 13:30 | Quem reservou e não retirou é marcado e recebe a taxa |
| `locked` | qualquer hora | Trava manual do administrador |

Os horários são configuráveis. A transição entre fases é calculada a cada
segundo no cliente, com a regra isolada em [`src/lib/schedule.js`](src/lib/schedule.js).

## Funcionalidades

- **Estação de refeição** — tela de totem onde o funcionário se identifica por PIN
- **Reserva e retirada** com validação da fase corrente
- **Painel administrativo** — funcionários, unidades, usuários e configurações
- **Relatório diário** — quem reservou, quem retirou, quem faltou
- **Relatório mensal** — consolidação por funcionário, com exportação CSV
- **Lançamento manual** — reserva em lote para casos excepcionais
- **Pedido por WhatsApp** — monta a mensagem do dia e abre o WhatsApp do restaurante
- **Atualização em tempo real** — reservas aparecem em todas as telas abertas
- **Bloqueio do sistema** por inadimplência, reversível apenas pelo dono

## Stack

| Camada | Escolha |
|---|---|
| Front-end | React 18, Vite, React Router |
| Estado de servidor | TanStack Query |
| UI | Tailwind CSS, shadcn/ui (Radix) |
| Banco | PostgreSQL (Supabase) |
| Autenticação | Supabase Auth (usuário + senha) |
| Autorização | Row Level Security no Postgres |
| Tempo real | Supabase Realtime |
| Testes | Vitest |

---

## Arquitetura

### Autorização mora no banco, não na tela

Toda regra de acesso é uma **policy de Row Level Security** no PostgreSQL
([`supabase/schema.sql`](supabase/schema.sql)). O front-end nunca é a fronteira de
segurança: mesmo que alguém chame a API diretamente, o banco recusa.

Três papéis:

- **`dono`** — acesso total; único que pode reverter o bloqueio por inadimplência
- **`admin`** — painel completo, enxerga todas as unidades
- **`user`** — enxerga **apenas** a unidade vinculada ao seu perfil

A regra mais importante do sistema, expressa como policy:

```sql
create policy reservations_read on public.meal_reservations
  for select to authenticated
  using (public.is_admin() or unidade_id = public.my_unidade());
```

As funções auxiliares (`is_admin()`, `my_unidade()`) são `SECURITY DEFINER` por
necessidade: uma policy da tabela `profiles` que consultasse `profiles` entraria
em recursão infinita.

### A camada de dados é uma fachada

[`src/api/client.js`](src/api/client.js) expõe uma interface enxuta —
`entities.X.list/filter/create/update/delete/bulkCreate/subscribe` e
`auth.me/signIn/logout` — sobre o Supabase.

Essa fachada foi o que tornou a migração viável: as 21 telas e hooks que consomem
dados nunca souberam qual era o backend. Trocar a plataforma foi trocar a
implementação da fachada, não o sistema.

As funções puras vivem separadas ([`query-helpers.js`](src/api/query-helpers.js),
[`schedule.js`](src/lib/schedule.js), [`username.js`](src/lib/username.js))
justamente para serem testáveis sem credenciais — é por isso que a suíte roda em
CI sem nenhum segredo configurado.

### Criação de usuários é server-side

Não há auto-cadastro: contas são criadas pelo administrador. Criar usuário exige
a `service_role key` do Supabase, que dá acesso irrestrito ao projeto e **jamais**
pode ir para o front-end. A operação vive numa Edge Function
([`supabase/functions/admin-create-user`](supabase/functions/admin-create-user/index.ts))
que valida o papel de quem chamou antes de usar a chave privilegiada.

O sistema autentica por **nome de usuário**, mas o Supabase Auth exige e-mail. A
ponte é um domínio sintético (`usuario@mysztec.local`): nenhum e-mail é enviado e
a caixa não existe.

---

## Rodando localmente

**Pré-requisitos:** Node 18+ e uma conta no [Supabase](https://supabase.com) (plano gratuito serve).

### 1. Banco de dados

Crie um projeto no Supabase e rode [`supabase/schema.sql`](supabase/schema.sql)
inteiro no **SQL Editor**. Ele cria tabelas, índices, policies, triggers,
realtime e a configuração inicial.

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com os valores de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> A `anon key` é pública por design — quem protege os dados são as policies de RLS.
> A `service_role key` **nunca** entra no `.env` do front-end.

### 3. Primeiro usuário

Como não há auto-cadastro, o primeiro `dono` é criado à mão. No painel do
Supabase, em **Authentication → Users → Add user**, crie
`dono@mysztec.local` com uma senha, marque *Auto Confirm*, e então rode no SQL Editor:

```sql
insert into public.profiles (id, username, email, full_name, role)
select id, 'dono', email, 'Dono', 'dono'
from auth.users where email = 'dono@mysztec.local';
```

Daí em diante os demais usuários são criados pela tela **Admin → Usuários**.

### 4. Subir

```bash
npm install
npm run dev
```

### 5. Edge Function (opcional)

Necessária apenas para criar usuários pela interface:

```bash
supabase functions deploy admin-create-user
```

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm test         # suíte de testes
npm run lint     # análise estática
```

---

## Migração: de plataforma low-code para stack própria

O sistema rodava no Base44, que fornecia banco, autenticação, permissões e
hospedagem através de um SDK proprietário. A migração teve três frentes:

**1. Substituir o SDK.** O acoplamento era menor do que aparentava: apesar de 21
arquivos importarem o client, todos usavam apenas 9 métodos. Reimplementar essa
superfície sobre o Supabase manteve o resto do código intacto.

**2. Reimplementar as permissões.** No Base44 as regras de acesso eram declarativas
em JSON. Foram traduzidas para policies de RLS em SQL — mais verbosas, porém
versionadas junto do código e auditáveis.

**3. Reconstruir a autenticação.** Era a única parte genuinamente acoplada: login
hospedado, token na URL, conceito próprio de "usuário registrado". Foi substituída
por Supabase Auth com tela de login própria e perfis na tabela `profiles`.

### Problemas que a migração expôs

| Problema | No Base44 | Agora |
|---|---|---|
| Reserva duplicada | Impedida só pelo front-end | `unique (employee_id, date)` no banco |
| `unidade_id: ''` | Aceito silenciosamente | Coluna `uuid` rejeita `''`; normalizado na fachada |
| Fechamento do dia | Rodava no navegador; sem aba aberta, não fechava | Função SQL agendável via `pg_cron` |
| Dependências | 60 no `package.json` | 19 realmente usadas |

O fechamento do dia merece nota: `useEndOfDayProcessor` roda no cliente e depende
de alguém ter o sistema aberto após o horário de retirada. A função
`close_pending_reservations()` no banco resolve isso de forma confiável — o hook
segue como fallback.

## Limitações conhecidas

- O bundle passa de 500 KB; falta code-splitting por rota.
- Não há testes de integração contra um Postgres real — as policies de RLS são
  verificadas manualmente. É a lacuna mais relevante da suíte.
- `useEndOfDayProcessor` mantém a execução no cliente; o agendamento via `pg_cron`
  precisa ser habilitado manualmente no projeto Supabase.
