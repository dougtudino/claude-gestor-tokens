---
name: maquina
description: Central de comando entre computadores — dá nome a este PC (NB, MAC, DK...), liga a pasta sincronizada onde ficam o mapa das sessões e as notas de cada projeto, e responde onde está cada sessão. Use quando o usuário falar em "outro computador", "no mac", "no desktop", "no notebook", "onde está aquela sessão", "em que PC", "sessões compartilhadas", ou ao instalar o gestor num PC novo.
argument-hint: "[mapa | NB | MAC | DK | <nome>]"
---

# Central de comando (vários PCs)

Cada PC tem um nome curto. A pasta `_CLAUDE` no Google Drive (a mesma da skill `organizar-conversas`)
guarda o mapa `SESSOES.md`, o inventário de cada PC e a última nota de cada projeto por PC.
**Sessões não viajam**: cada uma mora no PC onde nasceu. Viajam o código (git) e as notas.

## 1. Ver como este PC está

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/maquina.js"
```

## 2. Configurar (se aparecer "NOME NÃO CONFIGURADO" ou "Central: NENHUMA", ou se $ARGUMENTS trouxe um nome)

Nomes do Douglas: **NB** = notebook (principal), **MAC** = MacBook (apps Apple), **DK** = desktop da
imobiliária. Se não der para saber qual PC é este pelo hostname/sistema, pergunte.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/maquina.js" --nome <NB|MAC|DK> --descricao "<o que é>" [--central "<pasta>"]
```

Pasta central (só passe `--central` se não foi achada sozinha):
- Windows: `G:\Meu Drive\_CLAUDE` (a letra do Drive pode mudar).
- Mac: `~/Library/CloudStorage/GoogleDrive-<conta>/Meu Drive/_CLAUDE` (ou `My Drive`).
- Sem Google Drive nesse PC: qualquer pasta sincronizada (Dropbox, OneDrive) que os três PCs vejam.
Se a pasta não existe, crie `_CLAUDE` dentro do Drive (é a única pasta que você cria).

Depois, popule o mapa: `node "${CLAUDE_PLUGIN_ROOT}/scripts/relatorio-sessoes.js" --dias 14 --central`.

## 3. "Onde está…?" / `mapa`

Leia só o começo de `<central>/SESSOES.md` (tabelas Computadores e Projetos) e responda curto:
em que PC está a sessão/projeto, há quanto tempo parou e qual a nota mais nova. Para continuar
em outro PC: abrir o mesmo projeto lá, `git pull`, e dizer "continua" (o gestor carrega a nota
mais nova, venha de qual PC vier). O que o outro PC precisa fazer (commit/push pendente,
sessão pesada) vai como "faça no <PC>".

Dica para mandar comandos de um PC para outro: com o Remote Control ligado no app
(`connect_new_sessions_to_remote_control`), as sessões dos outros PCs aparecem no `ListAgents` e no
claude.ai/code enquanto o PC estiver ligado — dá para escrever nelas de qualquer lugar.

## Regras

- Na central vai só: título, projeto, pasta, horário, contexto, modelo e a nota da sessão. Nunca
  pedidos da conversa, segredos ou arquivos do projeto.
- Nome de sessão com o PC na frente: `<PC> · <Projeto> · <assunto>`.
