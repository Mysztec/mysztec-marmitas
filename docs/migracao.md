# Migração: de plataforma low-code para stack própria

O sistema foi construído no **Base44**, que fornecia banco, autenticação,
permissões e hospedagem através de um SDK proprietário. Este documento registra
como ele saiu de lá.

## O acoplamento era menor do que parecia

Vinte e um arquivos importavam o client da plataforma, o que sugeria um sistema
profundamente amarrado. Ao mapear as chamadas, porém, todas cabiam em **nove
métodos**:

```
entities:  list · filter · create · update · delete · bulkCreate · subscribe
auth:      me · logout
```

Reimplementar essa superfície sobre o Supabase manteve o restante do código
intacto. É o argumento prático para concentrar acesso a dados numa fachada: a
plataforma inteira foi trocada sem que as telas soubessem.

## As três frentes

**1. Substituir o SDK.** A fachada em [`src/api/client.js`](../src/api/client.js)
reproduz a mesma assinatura sobre o Supabase, incluindo convenções herdadas de
propósito — `created_date`/`updated_date` em toda linha e ordenação em string
(`'-date'`). Manter essas convenções evitou reescrever consultas em dezenas de
componentes.

**2. Reimplementar as permissões.** No Base44 as regras de acesso eram
declarativas em JSON. Viraram policies de Row Level Security em SQL: mais
verbosas, porém versionadas junto do código, auditáveis e válidas mesmo para quem
chama a API sem passar pela interface.

**3. Reconstruir a autenticação.** Era a única parte genuinamente acoplada —
login hospedado pela plataforma, token na URL, conceito próprio de "usuário
registrado". Foi substituída por Supabase Auth, com tela de login própria e
perfis na tabela `profiles`.

## O que a migração revelou

Sair de uma plataforma que decide muita coisa por baixo dos panos expõe o que ela
estava segurando. Quatro exemplos:

| Ponto | Antes | Depois |
|:--|:--|:--|
| Reserva duplicada | Impedida apenas pelo front-end | `unique (employee_id, date)` no banco |
| Campo de referência vazio | `unidade_id: ''` aceito em silêncio | Coluna `uuid` rejeita `''`; normalizado na fachada |
| Fechamento do dia | Rodava no navegador — sem aba aberta, o dia não fechava | Função SQL agendada por `pg_cron` |
| Dependências | 60 no `package.json`, herdadas do template | 19 efetivamente usadas |

O fechamento do dia é o mais ilustrativo. A rotina que marca como *não retirada*
quem reservou e não apareceu rodava num `useEffect`: dependia de alguém ter o
sistema aberto depois do horário de retirada. Como ela gera cobrança, o efeito
prático era cobrança inconsistente. Virou
`close_pending_reservations()`, executada pelo banco em horário fixo.

## Lição de implantação

As funções de PIN nasceram com `set search_path = public`. No Supabase a extensão
`pgcrypto` vive no schema `extensions` — dentro das funções, `crypt()` e
`gen_salt()` ficavam invisíveis e a chamada estourava.

O erro escapou da verificação porque a migração roda como `postgres`, cujo
`search_path` padrão já inclui `extensions`: o script deu *Success* e apenas a
execução via API falhava. **Migração que passa não é o mesmo que funcionalidade
que funciona** — o teste precisa exercitar o caminho real.

O sintoma no front foi pior que a causa: o teclado de PIN travava sem mensagem,
porque o `.then()` que tratava a resposta não tinha `.catch()`. Uma promessa
rejeitada deixava a trava de reentrância presa. Daí a regra geral — **toda
promessa que controla estado de interface precisa de tratamento de falha**, ou um
erro de rede vira tela morta.

## Auditoria de segurança

A migração foi seguida de uma auditoria, que encontrou falhas herdadas do desenho
original — a principal delas com o PIN dos funcionários guardado em texto plano e
conferido no navegador. O relato está em
**[auditoria-seguranca.md](auditoria-seguranca.md)**.
