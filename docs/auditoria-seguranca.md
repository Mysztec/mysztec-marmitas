# Auditoria de segurança

Registro da auditoria feita depois que o sistema saiu da plataforma low-code.
Todas as falhas descritas aqui **estão corrigidas** — o documento existe para
registrar o raciocínio, não o estado atual.

## A falha principal

O PIN dos funcionários ficava em texto plano numa tabela legível por qualquer
usuário autenticado, e era conferido no navegador:

```js
if (pin !== selectedEmployee.pin) return { error: 'Senha incorreta' };
```

Duas consequências, ambas graves:

1. **O PIN de todos os funcionários era baixado para cada navegador** que abrisse
   o sistema. Bastava abrir as ferramentas de desenvolvedor.
2. **A conferência acontecia no cliente** — ou seja, não conferia nada. Uma
   chamada direta à API reservava ou dava baixa em nome de qualquer pessoa.

O PIN era a única coisa separando um funcionário de lançar marmita, e a
respectiva taxa, na conta de outro.

### A correção

O PIN passou a ser hash bcrypt, a coluna em texto plano deixou de existir, e a
decisão foi para o banco:

```sql
select public.reserve_meal(p_employee := '...', p_pin := '1234');
```

A função valida, na mesma transação: PIN, janela de horário, unidade do
funcionário e bloqueio do sistema. Data e status da reserva passaram a vir do
servidor — o cliente não escolhe nenhum dos dois.

## Demais correções

| Falha | Risco | Correção |
|:--|:--|:--|
| PIN conferido no cliente | Reserva e retirada sem PIN, via API | Função `SECURITY DEFINER` no banco |
| Sem limite de tentativas | Força bruta sobre um PIN curto | Bloqueio automático após erros seguidos |
| Cliente escolhia `date` e `status` | Reserva retroativa, baixa forjada | Definidos no servidor |
| `admin` podia se promover a `dono` | Burlar o desbloqueio exclusivo do dono | Trigger de guarda em `profiles` |
| Rotina de fechamento exposta na API | Gerar taxa para todos de uma vez | Execução revogada; roda por `pg_cron` |
| Escrita livre em reservas | Alterar reserva alheia da mesma unidade | Escrita direta restrita a admin |
| Nome interpolado cru no relatório impresso | XSS armazenado | Escape de HTML, com teste |
| Papel anônimo com acesso ao schema | Leitura sem login | Privilégios revogados |

## Princípios que guiaram as correções

**A interface não é fronteira de segurança.** Guardas de rota e campos
desabilitados existem para orientar quem usa o sistema, não para impedir quem não
deveria estar ali. Toda regra que importa foi para o banco, onde vale mesmo para
quem chama a API diretamente.

**Identidade não é autorização.** Uma das telas liberava acesso comparando o
e-mail do usuário com uma constante no código. Além de expor um endereço pessoal
no bundle, a regra não existia no servidor. Virou verificação de papel, o mesmo
critério que as policies aplicam.

**O que é sensível não trafega.** O PIN de terceiros deixou de chegar ao
navegador; as funções internas deixaram de ser chamáveis pela API; a chave
privilegiada existe apenas dentro da Edge Function, injetada pelo próprio
provedor.

**Toda ação sensível tem dono.** Redefinir a senha de alguém reabre uma janela de
cadastro — por isso fica registrado quem fez e quando.
