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

E os **popups** (recomendado — o gestor pede, você clica):

```
/plugin install gestor-popups@gestor-tokens
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
| `/gestor-tokens:supervisionar` | Visão de cima de todas as sessões (feito para rotina diária) |

E o subagente **`gestor-tokens:gestor-tokens`** — chame com "@gestor-tokens" ou peça
"pergunta pro gestor de tokens…". Ele também é acionado sozinho quando faz sentido.

## Popups: o gestor pede, você clica (`gestor-popups`)

Um mod do Claude Code (API de plugins com interface, no app desktop e no terminal):

| Quando | Faixa acima da caixa de mensagem |
|---|---|
| Sessão nova num projeto com nota | `📌 Última sessão: …` → **[Continuar de onde parei]** **[Assunto novo]** |
| Contexto em 70% do ponto de compactação | `💾 Contexto em 72%…` → **[Compactar agora]** **[Depois]** |
| Contexto em 90% | `⚠️ …` → **[Compactar agora]** **[Depois]** |
| Pedido simples (renomear, formatar, status…) no Opus/Fable | `🧠 O Sonnet faz isso pela metade do preço` → **[Trocar para Sonnet]** **[Manter]** |

- **`/gestor`** abre um menu com opções: Salvar nota · Compactar agora · Checkup · Supervisionar sessões.
- **Status fixo** sob a caixa: `🧠 Opus · contexto 34% de 300k (102k) · $1.84`.
- **Toasts** quando compacta, troca de modelo, etc.
- "Compactar agora" compacta de verdade (mesma ação do `/compact`), com instruções do que manter.
- "Depois" não insiste na mesma faixa; volta só na próxima (90%) ou depois de compactar.

## Orgânico: o que roda sem você pedir

Depois de instalar, faça **um** ajuste no `~/.claude/settings.json` para as sessões compactarem
sozinhas num ponto econômico (sem ele, modelos de 1M só compactam perto de ~967k tokens):

```json
"autoCompactWindow": 300000
```

A partir daí, dentro de cada sessão:

| Quando | O quê |
|---|---|
| Sessão nova / `/clear` | O Claude **já recebe a última nota do projeto** e as regras de economia. É só dizer "continua" |
| Toda sessão | Buscas largas vão para subagente **Haiku**; se o modelo não combina com a tarefa, ele sugere o `/model` uma vez |
| 70% do ponto de compactação | O Claude **salva a nota sozinho**, sem perguntar |
| 90% | Aviso de compactação iminente |
| Compactação automática | O resumo vira nota em `.claude/sessoes/` |
| Ao encerrar | Nota automática, se teve trabalho e ninguém salvou |
| Entrega grande concluída | O Claude salva a nota sem perguntar |

E **de cima**, o supervisor (`/gestor-tokens:supervisionar`), feito para rodar como rotina diária
no app desktop:

- mede todas as sessões dos últimos 3 dias **sem gastar tokens** (um script lê as transcrições);
- grava a nota das sessões pesadas e paradas;
- renomeia, agrupa por projeto na barra lateral e arquiva as encerradas (PR fechado);
- recomenda troca de modelo (ex.: Opus fazendo trabalho mecânico → Sonnet, metade do preço);
- se você tem a skill `organizar-conversas`, usa as convenções dela (e a rodada completa às segundas).

Para agendar, peça no app: *"agenda o /gestor-tokens:supervisionar todo dia às 8h30"*.

O que **não** dá para automatizar (limite do Claude Code): digitar comandos de barra por você
(`/model`, `/compact`), uma sessão compactar outra, e trocar o modelo de outra sessão sem a sua aprovação.

Nada é criado fora de projetos. Projeto = repositório git (worktrees contam como o repo principal)
ou pasta com `.claude/` ou `CLAUDE.md` nela mesma.

### Ajustes por variável de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `GESTOR_SALVAR_PCT` | `70` | % do ponto de compactação em que o Claude salva a nota |
| `GESTOR_URGENTE_PCT` | `90` | % para o aviso de compactação iminente |
| `GESTOR_PESADA_TOKENS` | `150000` | A partir de quantos tokens o supervisor considera a sessão pesada |
| `GESTOR_JANELA` | detectada pelo modelo | Força o tamanho da janela do modelo |

Coloque em `~/.claude/settings.json` → `"env": { "GESTOR_SALVAR_PCT": "60" }`.

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
skills/           salvar, retomar, compactar, modelo, organizar, checkup, dicas, instalar-statusline, supervisionar
hooks/hooks.json  SessionStart, UserPromptSubmit, PostCompact, SessionEnd
scripts/          hooks, statusline e relatorio-sessoes (supervisor) em Node puro
templates/        CLAUDE.md modelo
tests/            teste dos hooks: node tests/testar-hooks.js
popups/           plugin gestor-popups (mod): hooks/register.tsx + tests (claude plugin test ./popups)
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
