---
name: instalar-statusline
description: Instala a barra de status do gestor-tokens no Claude Code (modelo, barra de contexto colorida, custo da sessão, projeto/branch e aviso de sessão sem nome). Use quando o usuário pedir statusline, barra de status, ou quiser ver o consumo de contexto o tempo todo.
disable-model-invocation: true
---

# Instalar a statusline

A statusline vive no `settings.json` do usuário, e o caminho do plugin muda a cada atualização.
Por isso o script é **copiado** para um lugar fixo.

## Passos

1. Leia `~/.claude/settings.json`. Se já existe `statusLine`, mostre o atual e pergunte se
   pode substituir. Sem OK, pare.
2. Copie `${CLAUDE_PLUGIN_ROOT}/scripts/statusline.js` para `~/.claude/gestor-tokens/statusline.js`
   (crie a pasta). Em Windows, `~` é `%USERPROFILE%`.
3. Edite `~/.claude/settings.json` acrescentando, sem mexer no resto do arquivo:

```json
"statusLine": {
  "type": "command",
  "command": "node \"<CAMINHO ABSOLUTO>/.claude/gestor-tokens/statusline.js\"",
  "padding": 0
}
```

   Use o caminho absoluto real com barras `/` (também no Windows).
4. Teste: rode o script com uma entrada de exemplo e mostre a saída:
   `echo '{"model":{"display_name":"Sonnet"},"context_window":{"context_window_size":200000,"used_percentage":42,"current_usage":{"input_tokens":84000}},"cost":{"total_cost_usd":0.37},"cwd":"."}' | node ~/.claude/gestor-tokens/statusline.js`
5. Diga em uma linha que a barra aparece na próxima mensagem, e como desfazer
   (apagar a chave `statusLine` do `settings.json`).

## O que a barra mostra

`🧠 Modelo · ██████░░░░ 62% (124k/200k) · $1.84 · 📁 projeto (branch) · nome da sessão`

- Barra verde até 59%, amarela de 60% a 79%, vermelha a partir de 80%.
- Sem nome de sessão, mostra `sem nome → /rename`.
- O custo é a estimativa local do Claude Code, não a fatura.
