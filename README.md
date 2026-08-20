<div align="center">

# 🍽️ Mysztec Marmitas

**Controle de reserva e retirada de marmitas para empresas com múltiplas unidades.**

[![CI](https://github.com/Mysztec/mysztec-marmitas/actions/workflows/ci.yml/badge.svg)](https://github.com/Mysztec/mysztec-marmitas/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Vitest](https://img.shields.io/badge/testes-28%20passando-success?logo=vitest&logoColor=white)

</div>

---

## O problema

Uma empresa com funcionários espalhados por vários barracões precisa saber, todo dia:

- **quem vai almoçar** — para encomendar a quantidade certa ao restaurante;
- **quem realmente retirou** — para cobrar quem reservou e não apareceu;
- **quanto cobrar de cada um** no fechamento do mês.

Em papel ou planilha isso vira erro de contagem, comida desperdiçada e discussão
na hora de acertar a conta.

## Como funciona

O dia opera em **fases automáticas**, definidas por horário configurável:

| Fase | O que acontece |
|:--|:--|
| 🟢 **Reserva** | O funcionário reserva a marmita digitando seu PIN no totem |
| ⏳ **Espera** | Janela fechada — o pedido já foi enviado ao restaurante |
| 🔵 **Retirada** | O funcionário confirma a retirada com o mesmo PIN |
| ⚫ **Encerrado** | Quem reservou e não retirou é marcado e recebe a taxa |
| 🔒 **Travado** | Bloqueio manual do administrador, a qualquer hora |

A fase é calculada nos dois lados, de propósito: no cliente a cada segundo, para
a tela reagir sozinha; e no banco, em `current_phase()`, que é quem de fato
decide se uma reserva pode ser gravada. **O cálculo do cliente é conveniência de
interface, não autorização.**

## Funcionalidades

| | |
|:--|:--|
| 🖥️ **Estação de refeição** | Tela de totem; o funcionário se identifica por PIN |
| 👥 **Gestão de funcionários** | Cadastro por unidade, com controle de acesso por papel |
| 🏭 **Múltiplas unidades** | Cada usuário enxerga apenas a unidade a que pertence |
| 📊 **Relatório diário** | Quem reservou, quem retirou, quem faltou |
| 📅 **Relatório mensal** | Consolidação por funcionário, com exportação CSV |
| 💬 **Pedido por WhatsApp** | Monta a mensagem do dia e abre a conversa com o restaurante |
| ⚡ **Tempo real** | Reservas aparecem em todas as telas abertas, sem recarregar |
| 🔐 **Bloqueio do sistema** | Trava por inadimplência, reversível apenas pelo dono |

## Stack

| Camada | Escolha |
|:--|:--|
| Front-end | React 18 · Vite · React Router |
| Estado de servidor | TanStack Query |
| Interface | Tailwind CSS · shadcn/ui (Radix) |
| Banco | PostgreSQL (Supabase) |
| Autenticação | Supabase Auth — usuário e senha |
| Autorização | Row Level Security, no banco |
| Tempo real | Supabase Realtime |
| Testes | Vitest |

---

## Decisões de arquitetura

### A autorização mora no banco, não na tela

Toda regra de acesso é uma **policy de Row Level Security** no PostgreSQL. O
front-end nunca é a fronteira de segurança: mesmo que alguém chame a API
diretamente, o banco recusa.

```sql
-- Usuário comum enxerga apenas reservas da própria unidade.
create policy reservations_read on public.meal_reservations
  for select to authenticated
  using (public.is_admin() or unidade_id = public.my_unidade());
```

Três papéis: **dono** (acesso total, único que reverte o bloqueio por
inadimplência), **admin** (painel completo, todas as unidades) e **usuário**
(apenas a unidade vinculada ao seu perfil).

### O acesso a dados passa por uma fachada

[`src/api/client.js`](src/api/client.js) expõe uma interface enxuta —
`entities.X.list/filter/create/update/delete` e `auth.me/signIn/logout` — sobre o
Supabase. As telas consomem essa fachada e não conhecem o backend.

As funções puras ficam separadas ([`schedule.js`](src/lib/schedule.js),
[`query-helpers.js`](src/api/query-helpers.js),
[`username.js`](src/lib/username.js)) para serem testáveis sem credenciais — é
por isso que a suíte roda em CI sem nenhum segredo configurado.

### Ninguém além do funcionário conhece o próprio PIN

Nem o RH que o cadastra, nem o dono. O PIN é hash **bcrypt** e a conferência
acontece no banco, dentro de uma função que valida na mesma transação o PIN, a
janela de horário, a unidade do funcionário e o bloqueio do sistema.

| Momento | O que acontece |
|:--|:--|
| RH cadastra a pessoa | Não define senha — o campo nem existe no formulário |
| Primeira reserva | O PIN digitado passa a ser a senha dela |
| Uso normal | Conferido no banco contra o hash |
| Muitas tentativas erradas | Bloqueado; o admin libera sem apagar a senha |
| Esqueceu a senha | O admin **apaga** e abre uma janela para ela cadastrar outra |

O administrador nunca escolhe uma senha — não existe caminho na API para isso.
Cada redefinição fica registrada com autor e horário.

### Criação de contas é server-side

Não há auto-cadastro. Criar usuário exige a `service_role key`, que dá acesso
irrestrito ao projeto e jamais pode ir para o front-end — então a operação vive
numa [Edge Function](supabase/functions/admin-create-user/index.ts) que valida o
papel de quem chamou antes de usar a chave privilegiada.

---

## Rodando localmente

**Pré-requisitos:** Node 18+ e uma conta no [Supabase](https://supabase.com) (o plano gratuito basta).

**1. Banco de dados** — crie um projeto e rode os arquivos de
[`supabase/migrations/`](supabase/migrations) **na ordem numérica**, no SQL Editor.

**2. Variáveis de ambiente**

```bash
cp .env.example .env
```

Preencha com os valores de *Project Settings → API*:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```

> A chave publicável vai no bundle do front-end — é pública por design. Quem
> protege os dados são as policies de RLS. A `service_role` **nunca** entra aqui.

**3. Primeiro administrador** — em *Authentication → Users*, crie
`dono@mysztec.local` com *Auto Confirm* marcado. Depois, no SQL Editor:

```sql
insert into public.profiles (id, username, email, full_name, role)
select id, 'dono', email, 'Dono', 'dono'
  from auth.users where email = 'dono@mysztec.local';
```

Os demais usuários passam a ser criados pela própria interface.

**4. Subir**

```bash
npm install
npm run dev
```

## Comandos

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm test         # suíte de testes
npm run lint     # análise estática
```

---

## Trade-offs assumidos

Nenhuma decisão de projeto é de graça. As principais:

**PIN de 4 dígitos em vez de senha forte.** O sistema é usado em pé, num totem,
por pessoas com as mãos ocupadas. Digitação rápida venceu robustez — compensada
com bloqueio automático após tentativas erradas e hash no banco. Aumentar para 6
dígitos é uma linha de código, caso o contexto de uso mude.

**O funcionário define a própria senha no primeiro uso.** Evita que o RH precise
inventar e comunicar senhas, o que na prática levaria a PINs anotados em papel. O
custo é uma janela curta em que a senha ainda não pertence a ninguém — por isso
ela fecha no primeiro uso e toda redefinição fica registrada.

**Bundle único, sem code-splitting.** Passa de 500 KB. Para uso interno em rede
local, dividir por rota não pagaria a complexidade hoje.

**As policies de RLS não têm teste automatizado.** São verificadas à mão contra a
API. É a maior lacuna da suíte e o próximo item da lista.

---

<div align="center">
<sub>

O sistema nasceu numa plataforma low-code e foi migrado para stack própria.
O relato dessa migração está em **[docs/migracao.md](docs/migracao.md)**.

</sub>
</div>
