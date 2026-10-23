# Gestor de Tokens — plugin para Claude Code

Um copiloto de método para o Claude Code. Ele não escreve o seu código: garante que você use a
ferramenta do jeito certo — **gastando menos tokens, sem perder sessões e com tudo organizado**.

- ⚠️ **Avisa** quando o contexto cresce (uma vez por faixa, sem encher o saco).
- 💾 **Salva** o estado da sessão em `.claude/sessoes/` — à mão ou sozinho, ao compactar e ao sair.
- 📌 **Retoma** de onde parou, lendo só a nota, não o projeto inteiro.
- 🧠 **Escolhe o modelo** e o esforço certos para cada tarefa.
- 🗂️ **Organiza** o projeto no padrão (CLAUDE.md curto, `.claude/`, `.gitignore`).
- 🩺 **Audita** o que pesa em toda mensagem (memória, MCPs, skills).
- 💡 **Ensina** com dicas curtas e comandos exatos.

## Instalação

Dentro do Claude Code:

```
/plugin marketplace add dougtudino/claude-gestor-tokens
/plugin install gestor-tokens@gestor-tokens
/reload-plugins
```

Ou pelo terminal:

```bash
claude plugin marketplace add dougtudino/claude-gestor-tokens
```

```bash
claude plugin install gestor-tokens@gestor-tokens
```

Requisito: **Node.js 18+** no PATH (os hooks são scripts Node sem dependências; funcionam em
Windows, macOS e Linux).

Para testar sem instalar: `claude --plugin-dir ./claude-gestor-tokens`.

## Comandos

| Comando | O que faz |
|---|---|
| `/gestor-tokens:salvar [assunto]` | Grava a nota da sessão (objetivo, feito, pendente, decisões, próximo passo) |
| `/gestor-tokens:retomar [termo]` | Lê a última nota e diz em 6 linhas onde você parou |
| `/gestor-tokens:compactar` | Salva e entrega o `/compact` com as instruções certas |
| `/gestor-tokens:modelo <tarefa>` | Recomenda modelo + esforço, com o porquê |
| `/gestor-tokens:organizar` | Deixa a pasta do projeto no padrão |
| `/gestor-tokens:checkup` | Relatório de consumo com as 3 melhorias de maior impacto |
| `/gestor-tokens:dicas [tema]` | Dicas de contexto, sessões, memória, modelos, atalhos, hooks, git |
| `/gestor-tokens:instalar-statusline` | Barra com modelo, contexto colorido, custo e projeto |

E o subagente **`gestor-tokens:gestor-tokens`** — chame com "@gestor-tokens" ou peça
"pergunta pro gestor de tokens…". Ele também é acionado sozinho quando faz sentido.

## O que roda sozinho (hooks)

| Quando | O quê |
|---|---|
| Abrir / `/clear` / retomar | Mostra a última nota do projeto e uma dica |
| Cada mensagem sua | Mede o contexto; avisa em 60% / 80% da janela (ou 150k / 300k tokens) |
| Depois de `/compact` | Grava o resumo da compactação em `.claude/sessoes/` |
| Ao encerrar | Grava nota automática se a sessão teve trabalho e você não salvou |

Nada é criado fora de projetos (pastas sem `.git` nem `.claude/`).

### Ajustes por variável de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `GESTOR_DICA_TOKENS` | `150000` | Tokens para a primeira dica |
| `GESTOR_AVISO_TOKENS` | `300000` | Tokens para o aviso forte |
| `GESTOR_JANELA` | detectada pelo modelo | Força o tamanho da janela (ex.: `200000`) |

Coloque em `~/.claude/settings.json` → `"env": { "GESTOR_AVISO_TOKENS": "250000" }`.

## O padrão de projeto

```
meu-projeto/
├── CLAUDE.md              # ≤ 150 linhas — lido em TODA mensagem
├── CLAUDE.local.md        # pessoal, fora do git
└── .claude/
    ├── settings.json
    ├── settings.local.json# fora do git
    └── sessoes/
        ├── ULTIMA.md      # ponteiro: @.claude/sessoes/<nota>.md
        └── 2026-10-23-1530-login-google.md
```

Sessões: `<Projeto> · <assunto>` (`/rename`). Uma sessão por assunto.

## As 10 regras de ouro

1. Uma sessão por assunto, com nome.
2. **Salvar → compactar/limpar.** Nunca o contrário.
3. `/compact` com instruções do que manter, no fim de cada fase.
4. CLAUDE.md com ~150 linhas; detalhe em `docs/`, lido sob demanda.
5. Sonnet por padrão; Opus para o difícil; Haiku para o mecânico; Fable só quando Opus não basta.
6. Plan mode antes de mudança grande.
7. Busca larga → subagente. Leitura → por trecho.
8. Log longo → arquivo, não a conversa.
9. MCP e plugin sem uso no projeto → desligar.
10. Trocar de modelo só em ponto de parada (o cache do prompt se perde).

## Estrutura do repositório

```
.claude-plugin/   plugin.json + marketplace.json
agents/           gestor-tokens.md (o especialista)
skills/           salvar, retomar, compactar, modelo, organizar, checkup, dicas, instalar-statusline
hooks/hooks.json  SessionStart, UserPromptSubmit, PostCompact, SessionEnd
scripts/          hooks e statusline em Node puro
templates/        CLAUDE.md modelo
tests/            teste dos hooks: node tests/testar-hooks.js
PROMPT.md         o prompt-mestre que define o comportamento do agente
```

## Desenvolvimento

```bash
node tests/testar-hooks.js
```

```bash
claude plugin validate .
```

Ao mudar algo, suba `version` em `.claude-plugin/plugin.json`; quem instalou atualiza com
`claude plugin update gestor-tokens@gestor-tokens`.

## Licença

MIT.
