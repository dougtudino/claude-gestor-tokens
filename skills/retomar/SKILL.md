---
name: retomar
description: Retoma o trabalho a partir da última nota de sessão salva em .claude/sessoes/ do projeto, reconstruindo o contexto em poucas linhas sem reler o projeto inteiro. Use no início de uma sessão nova, depois de /clear, ou quando o usuário disser "onde paramos", "continua", "retoma", "o que falta".
argument-hint: "[assunto ou data, opcional]"
---

# Retomar sessão

## Passos

1. Ache a nota:
   - com `$ARGUMENTS`: o arquivo de `.claude/sessoes/` cujo nome contém o termo (o mais recente);
   - sem argumento: o arquivo apontado por `.claude/sessoes/ULTIMA.md`;
   - sem `ULTIMA.md`: o `.md` mais recente da pasta.
   Se não houver nenhuma nota, diga isso em uma linha e sugira `/gestor-tokens:salvar` no fim
   desta sessão. Pare aí.
2. Leia **só a nota** e, se ela citar, o `git log --oneline -5` e o `git status` curtos.
   Não abra os arquivos-chave ainda: abra só quando a tarefa pedir (economia de tokens).
3. Confira se o mundo mudou desde a nota: commits novos, branch diferente, pendências já feitas.
4. Responda neste formato, e nada mais:

```
📌 <Projeto> · <assunto>  (nota de <data>)
Objetivo: <1 linha>
Feito: <2–4 itens curtos>
Pendente: <itens, o primeiro em negrito>
Mudou desde então: <ou "nada">
➡️ Próximo passo: <ação exata>
```

5. Pergunte se segue pelo próximo passo. Se a sessão não tem nome, sugira
   `/rename <Projeto> · <assunto>`.

## Regras

- Não refaça decisões registradas em "Decisões" sem motivo novo.
- Se a nota tem mais de 14 dias, avise: o código pode ter mudado; confira antes de agir.
