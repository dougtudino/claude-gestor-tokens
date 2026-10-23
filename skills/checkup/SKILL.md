---
name: checkup
description: Auditoria de consumo de tokens do Claude Code — mede o que pesa em toda mensagem (CLAUDE.md, imports, MCPs, skills, plugins) e os hábitos da sessão, e devolve um relatório curto com as 3 melhorias de maior impacto. Use quando o usuário disser que está gastando muito, batendo limite, que o Claude está lento, ou pedir um checkup/diagnóstico.
---

# Checkup de tokens

Relatório curto, com números. Só leitura: não altere nada sem o OK do usuário.

## O que medir

1. **Memória fixa** (lida em toda mensagem):
   - `~/.claude/CLAUDE.md`, `./CLAUDE.md`, `./CLAUDE.local.md` e os `@imports` deles.
   - Conte linhas e caracteres; estimativa de tokens ≈ caracteres ÷ 4.
   - 🔴 > 300 linhas somadas · 🟡 150–300 · 🟢 < 150.
2. **Ferramentas carregadas**:
   - Servidores MCP configurados (`.mcp.json`, `~/.claude.json`, `claude mcp list` se disponível).
     MCP sem uso no projeto é custo à toa: sugira desativar por projeto.
   - Plugins ativos (`enabledPlugins` em `~/.claude/settings.json`) e quantidade de skills em
     `~/.claude/skills/`. Muitas skills = muitas descrições no contexto.
3. **Sessão atual** (peça ao usuário para rodar `/context` e colar, se você não tiver o número):
   uso da janela e o que mais ocupa.
4. **Projeto**: existe `.claude/sessoes/`? `.gitignore` cobre arquivos locais?
   Pastas enormes que o Claude costuma varrer sem querer (`node_modules`, `dist`, dados)?
5. **Hábitos** (pela conversa): leu arquivos inteiros grandes? colou logs longos? ficou
   numa sessão só para assuntos diferentes? usa o modelo mais caro para tudo?

## Formato

```
🩺 Checkup de tokens — <projeto>

Memória fixa:  <N> linhas (~<T> tokens)   <🟢/🟡/🔴>
MCPs ativos:   <lista curta>               <🟢/🟡/🔴>
Skills/plugins:<N skills, M plugins>       <🟢/🟡/🔴>
Sessão:        <% da janela ou "rode /context">
Sessões salvas:<sim/não>

Top 3 melhorias (maior economia primeiro):
1. <ação> — economiza ~<estimativa> por mensagem
2. ...
3. ...
```

Feche oferecendo aplicar a melhoria nº 1.
