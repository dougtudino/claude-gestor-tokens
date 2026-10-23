---
name: organizar
description: Padroniza a pasta de um projeto para o Claude Code — cria ou enxuga o CLAUDE.md, monta a pasta .claude/ (settings, sessoes), ajusta o .gitignore e sugere nomes de sessão. Use quando o projeto não tem CLAUDE.md, quando o CLAUDE.md está grande, ao começar um projeto novo, ou quando o usuário pedir para organizar, padronizar ou "deixar do jeito certo".
---

# Organizar projeto

Leve a pasta ao padrão abaixo. **Mostre o plano antes de escrever** e só apague ou reescreva
conteúdo existente com o OK do usuário. Criar arquivo novo pode sem perguntar.

## Padrão

```
<projeto>/
├── CLAUDE.md              # ≤ 150 linhas, no git
├── CLAUDE.local.md        # pessoal, fora do git
├── .gitignore             # inclui CLAUDE.local.md e .claude/settings.local.json
└── .claude/
    ├── settings.json      # permissões/hooks do time, no git
    ├── settings.local.json# pessoal, fora do git
    └── sessoes/           # notas de sessão (/gestor-tokens:salvar)
        └── ULTIMA.md
```

## Passos

1. **Diagnóstico** (só leitura): existe CLAUDE.md? quantas linhas? existe `.claude/`?
   `.gitignore` cobre os arquivos locais? stack do projeto (package.json, pyproject, etc.)?
2. **CLAUDE.md**:
   - Não existe → crie a partir de `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md`, preenchido com o
     que você descobriu (comandos de build/test reais, estrutura real). Nada inventado: o que
     não souber, deixe como `<!-- preencher -->`.
   - Existe e tem > 150 linhas → proponha enxugar: mover detalhes para `docs/*.md` e deixar
     no CLAUDE.md só uma linha com `@docs/arquivo.md` quando for sempre necessário, ou só o
     caminho quando for consulta eventual (assim não pesa em toda mensagem).
   - Corte: textos óbvios para o modelo ("escreva código limpo"), regras repetidas,
     histórico de decisões antigas (vai para `docs/decisoes.md`).
3. **`.claude/sessoes/`**: crie com um `ULTIMA.md` vazio.
4. **`.gitignore`**: acrescente, se faltarem:
   ```
   CLAUDE.local.md
   .claude/settings.local.json
   ```
   Pergunte se as notas de sessão vão para o git (bom para times) ou não
   (então acrescente `.claude/sessoes/`).
5. **Resumo final** em até 8 linhas: o que mudou, tamanho do CLAUDE.md antes → depois,
   e o nome sugerido para a sessão: `/rename <Projeto> · <assunto>`.

## Convenções que você ensina

- Sessão: `<Projeto> · <assunto>`; a que coordena a área termina em `(comando)`.
- Nota de sessão: `AAAA-MM-DD-HHMM-assunto.md`.
- Uma sessão por assunto. Assunto novo → sessão nova (ou `/clear` depois de `salvar`).
- Projetos ativos numa pasta só (ex.: `~/projetos/` ou `C:\Projetos\01-ativos\`), arquivados em outra.
