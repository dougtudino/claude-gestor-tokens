---
name: dicas
description: Dicas práticas e corretas de uso do Claude Code, por tema (contexto, sessões, memória, modelos, atalhos, skills, hooks, git, permissões). Use quando o usuário pedir dicas, perguntar "como faço X no Claude Code", "qual o jeito certo", ou parecer estar usando a ferramenta de forma ineficiente.
argument-hint: "[tema]"
---

# Dicas de Claude Code

Com `$ARGUMENTS`, dê as dicas daquele tema. Sem argumento, escolha as 3 mais úteis para o que
está acontecendo nesta conversa. No máximo 5 dicas por resposta, formato `💡 dica — por quê`.
Se um comando citado aqui não existir na versão do usuário, diga para conferir com `/help`.

## Contexto (o que mais economiza)
- `/context` mostra o que ocupa a janela — olhe antes de culpar o modelo.
- `/compact <o que manter>` no fim de cada fase, não só quando a automática dispara.
- `/clear <nome>` ao trocar de assunto (o nome rotula a conversa anterior no `/resume`).
  Uma conversa por assunto custa menos que uma conversa eterna.
- `/autocompact <tokens>` (ou a variável `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, de 1 a 100)
  faz a compactação automática disparar mais cedo — útil em janelas de 1M, que só compactam
  perto de ~967k tokens.
- `/usage` mostra o custo da sessão e os limites do plano.
- Peça leitura por trecho ("leia a função X", "linhas 100–200"), não o arquivo inteiro.
- Não cole logs enormes: salve em arquivo e peça para buscar o erro nele.
- Busca larga ("onde isso é usado no projeto todo?") → peça um subagente; volta só a conclusão.

## Sessões
- `/rename <Projeto> · <assunto>` logo no começo. Sessão sem nome some na lista.
- `claude -c` retoma a última da pasta; `claude -r <nome>` (ou `/resume`) escolhe qual;
  `claude -n <nome>` já abre com nome.
- Antes de fechar: `/gestor-tokens:salvar`. Ao abrir: `/gestor-tokens:retomar`.

## Memória (CLAUDE.md)
- Três níveis: `~/.claude/CLAUDE.md` (você, todo projeto), `./CLAUDE.md` ou
  `./.claude/CLAUDE.md` (time, no git), `./CLAUDE.local.md` (você, só este projeto).
- O CLAUDE.md da raiz é relido depois de cada `/compact`: regra que não pode se perder vai nele.
- `@caminho/arquivo.md` importa outro arquivo — mas o importado também pesa em toda mensagem.
- `/memory` abre os arquivos de memória; `/init` gera um CLAUDE.md inicial.
- Regra boa é específica e tem motivo. "Seja cuidadoso" não ajuda; "rode `npm test` antes de
  commit porque o CI não roda testes de integração" ajuda.

## Modelos e esforço
- `/model` troca o modelo. Sonnet para o dia a dia; Opus para o difícil; Haiku para o mecânico.
- `/effort low|medium|high|xhigh` ajusta o quanto o modelo pensa; `/effort auto` volta ao padrão.
- Plan mode (`/plan` ou Shift+Tab) antes de mudança grande: alinhar o plano custa menos que refazer.
- Trocar de modelo invalida o cache: troque em pontos de parada.
- Detalhes: `/gestor-tokens:modelo <tarefa>`.

## Atalhos
- `Esc` interrompe; `Esc Esc` volta para editar uma mensagem anterior.
- `Shift+Tab` alterna modos (normal, aceitar edições, plan).
- `!` no começo roda um comando de shell direto.
- `@arquivo` anexa um arquivo à mensagem.

## Skills, agentes e hooks
- Skill = instrução que o Claude carrega só quando precisa (`skills/<nome>/SKILL.md`).
  A descrição da skill fica sempre no contexto: escreva descrições curtas.
- Subagente = outro Claude com contexto próprio (`agents/<nome>.md`); bom para tarefas que
  leem muito e devolvem pouco.
- Hook = comando que o Claude Code roda sozinho em eventos (início de sessão, antes de
  compactar, antes/depois de ferramenta). Configure com `/hooks` ou no `settings.json`.

## Git
- Peça commits pequenos e frequentes: facilita voltar e o Claude revisa menos coisa.
- Use worktrees (`git worktree`) para rodar duas sessões em paralelo sem conflito.

## Permissões
- `/permissions` para liberar comandos de leitura que você aprova sempre (menos interrupção).
- Nunca libere comandos destrutivos em massa (`rm -rf`, `git push --force`).
