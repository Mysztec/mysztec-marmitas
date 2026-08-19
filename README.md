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

Os horários são configuráveis. A fase é calculada nos dois lados, de propósito:
no cliente a cada segundo, para a tela reagir sozinha
([`src/lib/schedule.js`](src/lib/schedule.js)); e no banco, em
`public.current_phase()`, que é quem realmente decide se uma reserva pode ser
gravada. O cálculo do cliente é conveniência de interface, não autorização.

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
([`supabase/migrations/`](supabase/migrations)). O front-end nunca é a fronteira de
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

Crie um projeto no Supabase e rode, **na ordem**, os arquivos de
[`supabase/migrations/`](supabase/migrations) no **SQL Editor**:

1. [`0001_schema.sql`](supabase/migrations/0001_schema.sql) — tabelas, índices, policies, triggers, realtime e configuração inicial
2. [`0002_security.sql`](supabase/migrations/0002_security.sql) — hash de PIN, RPCs de reserva/retirada e demais travas
3. [`0003_fix_pin_enrollment.sql`](supabase/migrations/0003_fix_pin_enrollment.sql) — corrige o `search_path` das funções de PIN e restringe o cadastro da senha à reserva
4. [`0004_pin_reset.sql`](supabase/migrations/0004_pin_reset.sql) — redefinição de senha pelo administrador, com auditoria

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com os valores de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```

> A chave publicável (ou a `anon` legada) é pública por design — vai no bundle do
> front-end. Quem protege os dados são as policies de RLS.
> A `service_role` / `secret key` **nunca** entra no `.env` do front-end: ela só
> existe na Edge Function, injetada pelo próprio Supabase.

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

---

## Segurança

O sistema nasceu numa plataforma low-code, onde parte das travas era
declarativa e parte simplesmente não existia. Uma auditoria feita após a
migração encontrou falhas reais; a correção está em
[`0002_security.sql`](supabase/migrations/0002_security.sql).

### A falha principal

O PIN dos funcionários ficava em texto plano numa tabela que **qualquer usuário
autenticado podia ler**, e era conferido com uma comparação em JavaScript:

```js
if (pin !== selectedEmployee.pin) return { error: 'Senha incorreta' };
```

Duas consequências: o PIN de todos os funcionários era baixado para cada
navegador que abrisse o sistema, e a conferência acontecia no cliente — ou
seja, não conferia nada. Bastava uma chamada direta à API, com a chave pública
que vai no bundle, para reservar ou dar baixa em nome de qualquer pessoa.

Hoje o PIN é hash bcrypt, a coluna em texto plano não existe mais, e a decisão
acontece no banco:

```sql
select public.reserve_meal(p_employee := '...', p_pin := '1234');
```

A função confere PIN, janela de horário, unidade do funcionário e bloqueio do
sistema numa transação. Data e status vêm do servidor: o cliente não escolhe
nenhum dos dois.

### Demais correções

| Falha | Risco | Correção |
|---|---|---|
| PIN em texto plano e legível por todos | Personificar qualquer funcionário | Hash bcrypt; coluna removida |
| PIN conferido no cliente | Reserva/retirada sem PIN via API | RPC `SECURITY DEFINER` |
| Sem limite de tentativas | PIN de 4 dígitos por força bruta | 5 erros em 15 min bloqueiam |
| Cliente escolhia `date` e `status` | Reserva retroativa, baixa forjada | Definidos no servidor |
| `admin` podia se promover a `dono` | Burlar o desbloqueio exclusivo do dono | Trigger `guard_role_escalation` |
| `close_pending_reservations` exposta na API | Cobrar taxa de todos de uma vez | `REVOKE EXECUTE`; roda por `pg_cron` |
| Escrita livre em `meal_reservations` | Alterar reserva alheia da mesma unidade | Escrita direta só para admin |
| Nome interpolado cru no relatório impresso | XSS armazenado | `escapeHtml` com teste |
| Papel `anon` com acesso ao schema | Leitura sem login | `REVOKE ALL ... FROM anon` |

### Ciclo de vida da senha do funcionário

O sistema é desenhado para que **ninguém além do próprio funcionário conheça o
seu PIN** — nem o RH que o cadastra, nem o dono.

| Momento | O que acontece |
|---|---|
| RH cadastra a pessoa | Deixa o campo de senha vazio |
| Funcionário reserva pela 1ª vez | O PIN que ele digitar vira a senha dele |
| Uso normal | O PIN é conferido no banco contra o hash bcrypt |
| Errou 5 vezes em 15 min | Bloqueado; o admin libera com um clique, sem apagar a senha |
| Esqueceu a senha | O admin **apaga** a senha e abre uma janela de 30 min para a pessoa cadastrar outra no totem |

O administrador nunca escolhe uma senha. `reset_employee_pin()` apaga o hash e
grava `pin_enroll_until = agora + 30 min`; dentro dessa janela o funcionário
cadastra a nova senha em qualquer fase do dia, e a janela fecha no primeiro uso.
Cada redefinição é registrada em `pin_resets` com autor e horário.

`set_employee_pin()` continua existindo para o caso em que o admin precisa
mesmo definir a senha (alguém que não consegue ir até o totem), mas não é o
caminho normal e a tela não o oferece.

**O risco que sobra, declarado:** enquanto a janela está aberta, a primeira
senha digitada naquele nome passa a valer. É por isso que ela dura 30 minutos e
não um dia — e a confirmação na tela avisa o administrador para só redefinir
com a pessoa presente.

### Detalhe de implantação que custou caro

As funções de PIN nasceram com `set search_path = public`. No Supabase a
extensão `pgcrypto` vive no schema `extensions`, então `crypt()` e `gen_salt()`
ficavam invisíveis dentro delas e a chamada estourava com
`function gen_salt(unknown) does not exist`.

O erro só apareceu em produção porque a migração em si roda como `postgres`,
cujo `search_path` padrão já inclui `extensions` — o `UPDATE` de conversão dos
PINs funcionou, e só a execução via API falhava. A correção está em
[`0003`](supabase/migrations/0003_fix_pin_enrollment.sql).

O sintoma no front foi pior que o erro: o teclado de PIN travava sem mensagem,
porque o `.then()` que tratava a resposta não tinha `.catch()`. Uma promessa
rejeitada deixava a trava de reentrância presa em `true`. Vale a regra geral —
**toda promessa que controla estado de UI precisa de tratamento de falha**, ou
um erro de rede vira tela morta.

### Verificação

Contra a API pública, sem sessão, as seis tentativas são recusadas:

```
ler coluna pin           -> 400  column employees.pin does not exist
ler funcionarios         -> 401  permission denied
fechar o dia             -> 401  permission denied for function
checar PIN direto        -> 401  permission denied for function
ler tentativas de PIN    -> 401  permission denied
ler perfis/papeis        -> 401  permission denied
```

### O que continua sendo risco

- **PIN de 4 dígitos** é fraco por natureza. O bloqueio por tentativas limita a
  força bruta, mas o espaço é de 10 mil combinações. Trocar por 6 dígitos é uma
  mudança de uma linha na validação, ponderada contra o uso em totem.
- **Primeiro PIN informado passa a valer** quando o funcionário ainda não tem
  um — intencional, e detalhado em
  [Ciclo de vida da senha](#ciclo-de-vida-da-senha-do-funcionário). O risco
  residual é a janela em que quem digitar primeiro define o PIN daquele nome.
- **A rota `/admin` é protegida no cliente** por conveniência de navegação. Não
  é a fronteira de segurança — quem garante o acesso são as policies de RLS,
  que valem mesmo se alguém digitar a URL direto ou chamar a API sem passar
  pela interface.
- **Não há testes automatizados das policies de RLS.** É a maior lacuna da
  suíte: as verificações acima foram feitas à mão.

---

## Limitações conhecidas

- O bundle passa de 500 KB; falta code-splitting por rota.
- `useEndOfDayProcessor` mantém a execução no cliente; o agendamento via `pg_cron`
  precisa ser habilitado manualmente no projeto Supabase.
