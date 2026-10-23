---
name: salvar
description: Salva o estado da sessão atual do Claude Code numa nota em .claude/sessoes/ do projeto (objetivo, o que foi feito, pendências, decisões, arquivos tocados, próximo passo). Use antes de /compact, /clear, de fechar a sessão, quando o contexto passar de 60%, ou quando o usuário disser "salva", "guarda onde paramos", "checkpoint", "não quero perder isso".
argument-hint: "[assunto curto]"
---

# Salvar sessão

Objetivo: qualquer pessoa (ou uma sessão nova, sem memória desta) consegue continuar o trabalho
lendo só a nota. Escreva para quem chega frio.

## Passos

1. **Descubra a raiz do projeto**: a raiz do repositório git (`git rev-parse --show-toplevel`) ou,
   sem git, a pasta de trabalho atual.
2. **Assunto**: use `$ARGUMENTS` se veio; senão, resuma o trabalho em 2 a 4 palavras
   (minúsculas, hífens, sem acento). Ex.: `login-google`, `refatora-api-pedidos`.
3. **Crie** `.claude/sessoes/AAAA-MM-DD-HHMM-<assunto>.md` com o modelo abaixo. Data e hora locais.
4. **Atualize** `.claude/sessoes/ULTIMA.md` para conter só a linha:
   `@.claude/sessoes/<arquivo>.md` (o `@` permite importar a nota direto no CLAUDE.md, se quiser).
5. **Git**: se `git status` mostra alterações, liste-as na nota. **Não faça commit** sem pedir.
6. **Confirme** em uma linha: `✅ Sessão salva em .claude/sessoes/<arquivo>.md`.
   Se foi o gestor que pediu o salvamento (aviso de contexto), pare aí: a compactação é automática.
   Se foi o usuário, sugira o próximo passo (`/clear` se vai mudar de assunto, `/rename` se a sessão
   não tem nome).

## Modelo da nota

```markdown
# <Projeto> · <assunto>
Data: AAAA-MM-DD HH:MM · Modelo: <modelo atual> · Branch: <branch ou "sem git">

## Objetivo
<1 a 3 linhas: o que o usuário quer no fim>

## Feito
- <fato verificado, com arquivo:linha quando ajudar>

## Pendente
- [ ] <próxima tarefa concreta>
- [ ] ...

## Decisões (e por quê)
- <decisão> — <motivo>. Não reabrir sem motivo novo.

## Armadilhas encontradas
- <erro que custou tempo e como foi resolvido>

## Arquivos-chave
- `caminho/arquivo` — <papel>

## Próximo passo exato
<o primeiro comando ou edição que a próxima sessão deve fazer>
```

## Regras

- Só fatos verificados. O que não foi testado vai em "Pendente", não em "Feito".
- Curto: a nota inteira deve caber em ~60 linhas. Não cole código nem logs; aponte o arquivo.
- Nunca grave segredos (tokens, senhas, chaves) na nota.
- Se `.claude/sessoes/` não existir, crie. Se o projeto não tiver `.gitignore` para
  `CLAUDE.local.md` e `.claude/settings.local.json`, sugira `/gestor-tokens:organizar`.
