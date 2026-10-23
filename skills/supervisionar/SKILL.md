---
name: supervisionar
description: Supervisor de todas as sessões do Claude Code nesta máquina — mede contexto e modelo de cada uma sem gastar tokens, grava nota das sessões pesadas e paradas, renomeia, agrupa por projeto na barra lateral, arquiva as encerradas e recomenda troca de modelo. Use na rotina diária agendada, ou quando o usuário pedir "supervisiona", "olha minhas sessões", "organiza minhas conversas", "como estão minhas sessões".
---

# Supervisor de sessões

Você olha o Claude Code de cima. Seja barato: **não abra transcrições**; o script já mede tudo.
A rodada inteira deve caber em poucas chamadas de ferramenta e terminar com um relatório curto.

## 1. Medir (sem tokens)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/relatorio-sessoes.js" --dias 3 --gravar
```

A tabela traz, por sessão: projeto, título, parada há quanto tempo, contexto (% do ponto de
compactação), modelo, nº de pedidos, nota e último pedido. Com `--gravar`, o script já gravou a
nota em `.claude/sessoes/` de toda sessão pesada (≥150k), parada há 2h+ e sem nota recente.

## 2. Organizar a barra lateral (app desktop)

Só se as ferramentas do app estiverem disponíveis (`list_sessions`, `move_sessions`,
`set_session_title`, `archive_session`). Sem elas, pule para o passo 3.

**Se existir a skill `organizar-conversas`** (`~/.claude/skills/organizar-conversas/SKILL.md`):
ela é a dona das convenções (nomes de pastas, MAPA, conversa de comando).
- **Segunda-feira** (ou se o usuário pedir organização completa): rode a "rodada automática" dela.
- **Outros dias**: leia dela só os nomes das pastas e o padrão de títulos, e faça a versão leve abaixo.

**Versão leve** (também é o padrão quando a `organizar-conversas` não existe):
1. `list_sessions` (limite 100) e `list_groups`. Cruze com a tabela pelo `cwd` e título.
2. **Renomear** sessão com título genérico ou enganoso para `<Projeto> · <assunto>` (assunto tirado
   do último pedido). Não renomeie título que o usuário escreveu e que já diz o que é, nem rodada de rotina.
3. **Agrupar** sessão sem grupo na pasta do projeto (`move_sessions`). Projeto com 2+ sessões ganha
   pasta própria; com 1, vai para `Outros projetos`. Mover tira o fixado: se estava fixada, `set_pinned`
   de novo.
4. **Arquivar** (reversível; nunca apagar): PR `MERGED`/`CLOSED`, ou rodada de rotina que já tem uma
   mais nova. Nunca arquive sessão rodando (`isRunning`), fixada, ou com nota "sem" na tabela e
   contexto alto — grave a nota antes (rode o script de novo) ou deixe para o relatório.

## 3. Modelos

Compare o modelo de cada sessão com o tipo de trabalho do último pedido:
- Opus/Fable em trabalho mecânico (status, renomear, ajustes de texto, conferir, publicar) → recomende **Sonnet**.
- Haiku/Sonnet em arquitetura, bug difícil ou planejamento longo → recomende **Opus**.
- Não troque sozinho: trocar modelo de outra sessão pede aprovação do usuário. Liste no relatório.

## 4. Configuração

Confira em `~/.claude/settings.json` se `autoCompactWindow` está definido. Sem ele, as sessões só
compactam perto de ~967k tokens em modelos de 1M: recomende `300000` no relatório.

## 5. Relatório (máx. 12 linhas)

```
🛰️ Supervisor — <data>
Sessões ativas: <N> (<P> pesadas) · notas gravadas: <K>
Organizado: <renomeadas> renomeadas · <agrupadas> agrupadas · <arquivadas> arquivadas (<motivos>)
Modelo: <sessão> está em Opus fazendo <tipo> → Sonnet economiza ~50%
Atenção: <sessão> em <X>% — vai compactar na próxima mensagem; se o assunto acabou, /clear
Depende de você: <decisões que só o usuário toma, ou "nada">
```

Se não há nada a fazer, o relatório é uma linha: `🛰️ Supervisor — tudo em ordem (<N> sessões).`
